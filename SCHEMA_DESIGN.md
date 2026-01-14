# Schema Design Documentation

## Overview

This document explains the Geldata schema design for the staff review application, mapping the Excel spreadsheet structure to a normalized database schema.

## Excel Structure Analysis

### Headers (from skeleton.xlsx)

| Column | Vietnamese | Description | Data Type |
|--------|-----------|-------------|-----------|
| A | ID Nhân viên | Employee ID | String |
| B | TÊN CHECK LIST CV | Checklist Name | String (Hierarchical) |
| C | ĐIỂM CHUẨN | Standard Score | Number |
| D | NGÀY | Date | Date |
| E | NHÂN VIÊN | Employee Checkbox | Boolean (X = true) |
| F | CHT | CHT Checkbox | Boolean (X = true) |
| G | ASM | ASM Checkbox | Boolean (X = true) |
| H | TL (%) ĐẠT | Achievement Percentage | Number |
| I | Số lần thực hiện Đạt | Successful Completions | Number |
| J | Có thực hiện như không Đạt | Implementation Issues | String |
| K | Số điểm Đạt được | Score Achieved | Number |
| L | Xếp loại | Classification | String |

### Hierarchical Structure

The "TÊN CHECK LIST CV" column contains a parent-child hierarchy:

```
CHECK LIST HẰNG NGÀY (Daily Checklist)
├── Task 1: Đánh giá sàng lọc...
├── Task 2: Đi làm đúng giờ...
├── Task 3: Đồng phục/tác phong...
├── Task 4: Kiểm soát việc thực hiện...
└── Task 5: Theo dõi chi phí quầy...

CHECK LIST HẰNG TUẦN (Weekly Checklist)
├── Theo dõi chỉ số điện, nước
├── Họp nhân viên bán hàng...
└── Kiểm soát việc lưu trữ...

CHECK LIST HẰNG THÁNG (Monthly Checklist)
├── Check lịch làm việc...
├── Đánh giá check list...
├── Tuyển dụng và đào tạo...
├── Kiểm tra báo cáo...
└── Xác nhận thay tem/tag...

XỬ LÝ KHI CÓ PHÁT SINH (Ad-hoc Tasks)
├── Xử lý khiếu nại...
├── Hỗ trợ thi công setup...
└── Báo cáo sự cố...
```

## Database Schema Design

### 1. ChecklistItem Type

Represents the hierarchical structure of checklist items (both parent categories and child tasks).

**Key Features:**
- **Self-referencing**: Uses `parent` link to create hierarchy
- **Computed children**: Automatically computes child tasks via backlink
- **Ordering**: `order` field maintains sequence within same level
- **Category flag**: `is_category` distinguishes parents from children

**Properties:**
- `name` (required str): The checklist item name
- `standard_score` (int32): Default score for this item (ĐIỂM CHUẨN)
- `classification` (str): Rating code (A, B, C, D, X)
- `parent` (link ChecklistItem): Reference to parent category
- `children` (multi link): Computed backlink to child tasks
- `order` (int32): Display order
- `is_category` (bool): True for parent categories
- `records` (multi link): Computed backlink to assessment records

**Example Data:**

```javascript
// Parent category
{
  name: "CHECK LIST HẰNG NGÀY",
  is_category: true,
  order: 1,
  parent: null
}

// Child task
{
  name: "Đi làm đúng giờ, đúng lịch ca làm việc",
  standard_score: 3,
  classification: "B",
  is_category: false,
  order: 2,
  parent: <link to "CHECK LIST HẰNG NGÀY">
}
```

### 2. ChecklistRecord Type

Represents individual assessment records (one per row in the spreadsheet).

**Properties:**
- `checklist_item` (required link): Reference to the checklist item being assessed
- `employee_id` (str): Employee identifier (ID Nhân viên)
- `assessment_date` (cal::local_date): Date of assessment (NGÀY)
- `employee_checked` (bool): Employee checkbox (NHÂN VIÊN)
- `cht_checked` (bool): CHT checkbox (CHT)
- `asm_checked` (bool): ASM checkbox (ASM)
- `achievement_percentage` (float32): Achievement % (TL (%) ĐẠT)
- `successful_completions` (int32): Number of successes (Số lần thực hiện Đạt)
- `implementation_issues` (str): Issues description (Có thực hiện như không Đạt)
- `score_achieved` (float32): Actual score (Số điểm Đạt được)
- `final_classification` (str): Final rating (Xếp loại)

**Constraint:**
- Unique combination of (checklist_item, employee_id, assessment_date) to prevent duplicates

### 3. Employee Type (Optional)

Represents employee information if needed for normalization.

**Properties:**
- `employee_id` (required str): Unique employee identifier
- `name` (str): Employee name
- `position` (str): Job title
- `department` (str): Department
- `records` (multi link): Computed backlink to assessment records

## Mapping to Univer Cell Types

When rendering data in Univer spreadsheet:

### Boolean Fields (Checkboxes)
```javascript
// NHÂN VIÊN, CHT, ASM columns
{
  v: employee_checked ? 1 : 0,  // 1 = checked, 0 = unchecked
  t: 3,                           // Boolean type
  s: checkboxStyleId
}
```

### Date Fields
```javascript
// NGÀY column
{
  v: 46032,  // Excel date serial number
  t: 2,      // Number type (dates stored as numbers)
  s: dateStyleId
}
```

### Text Fields
```javascript
// TÊN CHECK LIST CV, Classification, etc.
{
  v: "CHECK LIST HẰNG NGÀY",
  t: 1,  // String type
  s: textStyleId
}
```

### Number Fields
```javascript
// ĐIỂM CHUẨN, Achievement %, Score, etc.
{
  v: 3.5,
  t: 2,  // Number type
  s: numberStyleId
}
```

## Usage Examples

### Creating the Hierarchy

```edgeql
# Insert parent category
insert ChecklistItem {
  name := "CHECK LIST HẰNG NGÀY",
  is_category := true,
  order := 1
};

# Insert child task
insert ChecklistItem {
  name := "Đi làm đúng giờ, đúng lịch ca làm việc",
  standard_score := 3,
  classification := "B",
  is_category := false,
  order := 2,
  parent := (select ChecklistItem filter .name = "CHECK LIST HẰNG NGÀY")
};
```

### Creating Assessment Records

```edgeql
insert ChecklistRecord {
  checklist_item := (select ChecklistItem filter .name = "Đi làm đúng giờ..."),
  employee_id := "EMP001",
  assessment_date := <cal::local_date>'2026-01-12',
  employee_checked := true,
  cht_checked := true,
  asm_checked := false,
  achievement_percentage := 85.5,
  successful_completions := 20,
  score_achieved := 2.56,
  final_classification := "B"
};
```

### Querying Hierarchical Data

```edgeql
# Get all parent categories with their children
select ChecklistItem {
  name,
  standard_score,
  classification,
  children: {
    name,
    standard_score,
    classification,
    order
  } order by .order
}
filter .is_category = true
order by .order;

# Get all records for a specific checklist item
select ChecklistItem {
  name,
  records: {
    employee_id,
    assessment_date,
    employee_checked,
    cht_checked,
    asm_checked,
    score_achieved,
    final_classification
  }
}
filter .name = "Đi làm đúng giờ...";
```

## Migration Commands

```bash
# Create migration
gel migration create

# Apply migration
gel migration apply

# Check migration status
gel migration status
```

## Next Steps

1. **Run migrations** to create the database schema
2. **Seed initial data** with checklist items from skeleton.xlsx
3. **Update SheetPage.vue** to fetch data from Geldata instead of static data
4. **Implement data sync** between Univer UI and Geldata backend
5. **Add CRUD operations** for creating/updating assessment records

## References

- [Geldata Schema Documentation](https://docs.geldata.com/learn/schema)
- [Geldata Object Types](https://docs.geldata.com/reference/datamodel/objects)
- [Geldata Properties](https://docs.geldata.com/reference/datamodel/properties)
- [Geldata Links](https://docs.geldata.com/reference/datamodel/links)
- [Univer Cell Data Structure](https://docs.univer.ai/guides/sheets/model/cell-data)
