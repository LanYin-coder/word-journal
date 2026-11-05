import tempfile, unittest
from pathlib import Path
import server
class JournalTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory(); self.old=server.DB; server.DB=Path(self.temp.name)/'test.db'; server.init()
  with server.connect() as c: c.execute('INSERT INTO dictionary VALUES(?,?,?,?)',('seek','v. 寻找；查找','v.','si:k'))
 def tearDown(self): server.DB=self.old; self.temp.cleanup()
 def test_manual_and_phrases(self):
  rows=server.parse('seek v.查找，寻找\ntake off phr.起飞；脱下\nreluctant adj.不情愿的')
  self.assertTrue(all(not r['error'] for r in rows)); self.assertEqual(rows[0]['word'],'seek'); self.assertEqual(rows[0]['meaning'],'查找，寻找');self.assertEqual(rows[1]['word'],'take off'); self.assertEqual(rows[2]['pos'],'adj.')
 def test_dictionary_and_unknown(self):
  rows=server.parse('SEEK\nasdfxyz');self.assertEqual(rows[0]['source'],'ECDICT 本地词库');self.assertTrue(rows[1]['error'])
 def test_tab_csv_and_bad_spacing(self):
  rows=server.parse('seek\tv.寻找\n"seek","v.查找，寻找"\nseek查找')
  self.assertEqual(rows[0]['meaning'],'寻找');self.assertEqual(rows[1]['word'],'seek');self.assertTrue(rows[2]['error'])
 def test_multiple_parts_and_html(self):
  rows=server.parse('seek v.寻找 n.搜寻\nseek v.<script>查找</script>');self.assertEqual(rows[0]['pos'],'v./n.');self.assertIn('<script>',rows[1]['meaning'])
 def test_shared_period_parts_of_speech(self):
  for marker in ['v&n.', 'v.&n.', 'adj&adv.', 'n/adj.', 'n/v/adj.', 'v & n.', 'v＆n.', 'VT&N.']:
   with self.subTest(marker=marker):
    row=server.parse('hypothesis '+marker+' 假说，假设')[0]
    self.assertFalse(row['error']);self.assertEqual(row['word'],'hypothesis')
    self.assertEqual(row['pos'],marker);self.assertEqual(row['meaning'],'假说，假设')
 def test_combined_parts_in_csv_and_multiple_senses(self):
  row=server.parse('"record","v&n.记录，录音"')[0]
  self.assertEqual(row['pos'],'v&n.');self.assertEqual(row['meaning'],'记录，录音')
  row=server.parse('record v&n.记录 adj.创纪录的')[0]
  self.assertEqual(row['pos'],'v&n./adj.');self.assertEqual(row['meaning'],'记录 adj.创纪录的')
 def test_daily_phonetics_from_dictionary(self):
  with server.connect() as c:
   c.execute('INSERT INTO words VALUES(?,?,?,?)',('seek','寻找','v.','2026-01-01'))
   c.execute('INSERT INTO words VALUES(?,?,?,?)',('unknownword','自定义词','n.','2026-01-01'))
  words={w['word']:w for w in server.state('2026-01-02')['words']}
  self.assertEqual(words['seek']['phonetic'],'si:k')
  self.assertEqual(words['unknownword']['phonetic'],'')
 def test_daily_progress(self):
  with server.connect() as c:
   c.execute('INSERT INTO words VALUES(?,?,?,?)',('seek','寻找','v.','2026-01-01'))
   for day in ['2026-01-01','2026-01-02']:c.execute('INSERT OR IGNORE INTO entries VALUES(?,?)',('seek',day))
   for direction in ['zh','en']:c.execute('INSERT INTO reviews VALUES(?,?,?,?)',('seek','2026-01-02',direction,'known'))
  state=server.state('2026-01-03');self.assertEqual(state['words'][0]['study_days'],1);self.assertEqual(state['words'][0]['age_days'],2);self.assertEqual(state['words'][0]['recorded_days'],2)
if __name__=='__main__':unittest.main()
