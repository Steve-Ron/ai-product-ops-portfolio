-- 01_theme_distribution
SELECT r.review_theme AS theme, COUNT(*) AS issues, ROUND(COUNT(*)*100.0/(SELECT COUNT(*) FROM issues),2) AS sample_pct FROM issues i JOIN title_reviews r ON i.id=r.id GROUP BY r.review_theme ORDER BY issues DESC,theme;

-- 02_theme_by_state
SELECT r.review_theme AS theme, COUNT(*) AS issues, SUM(CASE WHEN i.state='开放' THEN 1 ELSE 0 END) AS open_issues, ROUND(100.0*SUM(CASE WHEN i.state='开放' THEN 1 ELSE 0 END)/COUNT(*),2) AS snapshot_open_pct FROM issues i JOIN title_reviews r ON i.id=r.id GROUP BY r.review_theme ORDER BY issues DESC;

-- 03_label_disagreements
SELECT original_theme,review_theme,COUNT(*) AS issues FROM issues i JOIN title_reviews r ON i.id=r.id WHERE changed=1 GROUP BY original_theme,review_theme ORDER BY issues DESC;

-- 04_theme_type_cross_tab
SELECT r.review_theme AS theme,i.feedback_type,COUNT(*) AS issues FROM issues i JOIN title_reviews r ON i.id=r.id GROUP BY r.review_theme,i.feedback_type ORDER BY theme,issues DESC;

-- 05_open_review_queue
SELECT i.id,r.review_theme,i.title,i.comments,i.triage_score, ROW_NUMBER() OVER(PARTITION BY r.review_theme ORDER BY i.triage_score DESC,i.comments DESC,i.id) AS theme_review_rank,i.url FROM issues i JOIN title_reviews r ON i.id=r.id WHERE i.state='开放' ORDER BY i.triage_score DESC,i.comments DESC,i.id;

-- 06_integrity
SELECT COUNT(*) AS joined_rows,COUNT(DISTINCT i.id) AS distinct_issues,SUM(CASE WHEN r.id IS NULL THEN 1 ELSE 0 END) AS unmatched_rows FROM issues i LEFT JOIN title_reviews r ON i.id=r.id;