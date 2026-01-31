# Update existing DetailCategory records with classification criteria

# Daily category: Use score-based thresholds
update DetailCategory
filter .category_type = DetailCategoryType.daily
set {
    classification_criteria := to_json('{"thresholds": {"A": 8.0, "B": 5.0, "C": 3.0}, "baseline": 26}')
};

# Weekly category: Use score-based thresholds
update DetailCategory
filter .category_type = DetailCategoryType.weekly
set {
    classification_criteria := to_json('{"thresholds": {"A": 8.0, "B": 5.0, "C": 3.0}}')
};

# Monthly category: Use score-based thresholds
update DetailCategory
filter .category_type = DetailCategoryType.monthly
set {
    classification_criteria := to_json('{"thresholds": {"A": 8.0, "B": 5.0, "C": 3.0}}')
};
