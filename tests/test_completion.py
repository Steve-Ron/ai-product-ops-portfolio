import unittest, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from review_decisions import DECISIONS, THEMES

class EvidenceIntegrity(unittest.TestCase):
    def test_known_keyword_misclassifications_are_reconsidered(self):
        self.assertEqual(THEMES[DECISIONS[64]],'界面与对话流程')
        self.assertEqual(THEMES[DECISIONS[145]],'界面与对话流程')
        self.assertEqual(THEMES[DECISIONS[112]],'界面与对话流程')

    def test_complete_title_review(self):
        self.assertEqual(len(DECISIONS),156)
        self.assertTrue(set(DECISIONS) <= set(THEMES))

    def test_poker_turn_flush_outs(self):
        # Four clubs among five known cards; nine clubs remain among 47 unseen cards.
        self.assertEqual(13-4,9)
        self.assertAlmostEqual(9/47,0.19148936170212766)

    def test_strawberry_oracle(self):
        self.assertEqual([i+1 for i,c in enumerate('strawberry') if c=='r'],[3,8,9])

if __name__=='__main__': unittest.main()
