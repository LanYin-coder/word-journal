import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
import pronunciation

class RecordingTests(unittest.TestCase):
 def test_original_recovery_and_cache(self):
  calls=[]
  def upstream(url):
   calls.append(url)
   if '/entries/' in url:
    return json.dumps([{'phonetics':[{'audio':'https://api.dictionaryapi.dev/broken.mp3','sourceUrl':'https://commons.wikimedia.org/w/index.php?curid=1','license':{'name':'CC BY-SA'}}]}]).encode(),'application/json'
   if '/w/api.php' in url:
    return json.dumps({'query':{'pages':{'1':{'imageinfo':[{'url':'https://upload.wikimedia.org/wikipedia/commons/a/ab/Test.ogg'}]}}}}).encode(),'application/json'
   return b'ID3'+b'0'*100,'audio/mpeg'
  with tempfile.TemporaryDirectory() as folder,patch.object(pronunciation,'CACHE',Path(folder)),patch.object(pronunciation,'fetch',side_effect=upstream):
   info=pronunciation.recording('seek')
   self.assertTrue(info['audio'].startswith('/api/pronunciation/audio?'))
   self.assertIn('/transcoded/',calls[-1]);self.assertEqual(info['license']['name'],'CC BY-SA')
   count=len(calls);self.assertEqual(pronunciation.audio_file('seek')[0][:3],b'ID3');self.assertEqual(count,len(calls))
 def test_rejects_error_body(self):
  def upstream(url):
   if '/entries/' in url:return b'[{"phonetics":[{"audio":"https://api.dictionaryapi.dev/broken.mp3"}]}]','application/json'
   return b'Bad Gateway','audio/mpeg'
  with tempfile.TemporaryDirectory() as folder,patch.object(pronunciation,'CACHE',Path(folder)),patch.object(pronunciation,'fetch',side_effect=upstream):
   with self.assertRaises(ValueError):pronunciation.recording('seek')
   self.assertEqual(list(Path(folder).iterdir()),[])
 def test_rejects_arbitrary_hosts_and_bad_words(self):
  with self.assertRaises(ValueError):pronunciation.fetch('https://localhost/internal')
  with self.assertRaises(ValueError):pronunciation.recording('../secret')
if __name__=='__main__':unittest.main()
