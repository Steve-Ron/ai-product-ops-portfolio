import sys, unittest, json, io
from unittest.mock import patch
from urllib.error import HTTPError
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from run_pipeline import load, prepare_cases, arena_tasks, validate_grade, DIMENSIONS, feedback_summary, api_call, APIError, judge

class PipelineTests(unittest.TestCase):
    def test_cases_have_real_turns_and_material(self):
        cases=prepare_cases(load('test_cases.json'))
        self.assertEqual(len(cases),24)
        self.assertEqual(len(next(c for c in cases if c['id']=='TC-007')['turns']),3)
        self.assertIn('张敏',next(c for c in cases if c['id']=='TC-021')['turns'][0])
    def test_arena_preserves_both_replies(self):
        tasks=arena_tasks(load('arena_records.json'))
        self.assertEqual(len(tasks),240)
        self.assertEqual(len({x['id'] for x in tasks}),240)
        self.assertTrue(all(x['response'] for x in tasks))
    def test_invalid_scores_cannot_be_published(self):
        grade={'scores':{d:{'score':None,'reason':'不适用'} for d in DIMENSIONS},'root':'证据不足','badcase':False,'evidence':'无'}
        validate_grade(grade)
        grade['scores'][DIMENSIONS[0]]['score']=8
        with self.assertRaises(ValueError): validate_grade(grade)
    def test_real_feedback_counts_reconcile(self):
        s=feedback_summary(load('feedback_issues.json'))
        self.assertEqual(s['total'],156)
        self.assertEqual(s['themes']['模型与API连接'],45)
        self.assertEqual(s['types']['问题反馈'],95)
        self.assertEqual(s['open'],51)
    def test_empty_choices_keeps_evidence(self):
        config={'base':'https://example.test','key':'fake','model':'test','extra':{}}
        with patch('run_pipeline.request.urlopen',return_value=io.BytesIO(b'{"id":"test-empty","choices":[]}')):
            with self.assertRaises(APIError) as caught: api_call(config,[])
        self.assertEqual(caught.exception.evidence['raw']['id'],'test-empty')
    def test_invalid_grade_keeps_judge_response(self):
        evidence={'text':'not-json','requestId':'test-invalid','usage':{'total_tokens':3}}
        with patch('run_pipeline.api_call',return_value=evidence):
            with self.assertRaises(APIError) as caught: judge({}, {'prompt':'test'})
        self.assertEqual(caught.exception.evidence,evidence)
    def test_rate_limit_retries_then_success(self):
        config={'base':'https://example.test','key':'fake','model':'test','extra':{}}
        body=json.dumps({'id':'ok','choices':[{'finish_reason':'stop','message':{'content':'answer'}}]}).encode()
        failure=HTTPError('https://example.test',429,'rate limit',{},None)
        with patch('run_pipeline.request.urlopen',side_effect=[failure,io.BytesIO(body)]) as http, patch('run_pipeline.time.sleep'):
            result=api_call(config,[])
        self.assertEqual(http.call_count,2)
        self.assertEqual(result['attempts'],2)
    def test_auth_failure_does_not_retry(self):
        config={'base':'https://example.test','key':'fake','model':'test','extra':{}}
        failure=HTTPError('https://example.test',401,'bad key',{},io.BytesIO(b'{"error":"unauthorized"}'))
        with patch('run_pipeline.request.urlopen',side_effect=failure) as http:
            with self.assertRaises(APIError): api_call(config,[])
        self.assertEqual(http.call_count,1)

if __name__=='__main__': unittest.main()
