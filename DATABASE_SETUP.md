
```bash
# Create a new migration from schema changes
gel migration create

# Review the migration
gel migration show
```

### 3. Apply Migration

```bash
# Apply the migration to create the database schema
gel migration apply
```

### 4. Seed Initial Data

Load the checklist structure from the seed file:

```bash
# Run the seed data script
gel query -f dbschema/seed_data.edgeql
```

Or run it interactively:

```bash
# Open Geldata REPL
gel

# Copy and paste the contents of seed_data.edgeql
```

## Verify Schema

### Check Object Types

```bash
gel describe type ChecklistItem
gel describe type ChecklistRecord
gel describe type Employee
```

### Query Data

```bash
# List all parent categories
gel query "select ChecklistItem { name, is_category } filter .is_category = true"

# Get hierarchy
gel query "
  select ChecklistItem {
    name,
    children: {
      name,
      standard_score,
      classification
    } order by .order
  }
  filter .is_category = true
  order by .order
"
```

## Schema Overview

### ChecklistItem
- Hierarchical structure (parent/child relationships)
- Self-referencing via `parent` link
- Computed `children` backlink
- Used for: checklist categories and individual tasks

### ChecklistRecord
- Individual assessment records
- Links to ChecklistItem
- Contains all the measurement data (scores, checkboxes, dates)
- Unique constraint on (checklist_item, employee_id, assessment_date)

### Employee (Optional)
- Employee master data
- Can be used to normalize employee information
- Has computed backlink to all their records

## Common Queries

### Get all daily checklist items

```edgeql
select ChecklistItem {
  name,
  standard_score,
  classification
}
filter .parent.name = "CHECK LIST HẰNG NGÀY"
order by .order;
```

### Create a new assessment record

```edgeql
insert ChecklistRecord {
  checklist_item := (
    select ChecklistItem
    filter .name = "Đi làm đúng giờ, đúng lịch ca làm việc và lấy vân tay theo đúng quy định"
  ),
  employee_id := "EMP001",
  assessment_date := <cal::local_date>'2026-01-12',
  employee_checked := true,
  cht_checked := true,
  asm_checked := false,
  achievement_percentage := 85.5,
  successful_completions := 20,
  implementation_issues := "",
  score_achieved := 2.56,
  final_classification := "B"
};
```

### Get all records for an employee

```edgeql
select ChecklistRecord {
  checklist_item: { name },
  assessment_date,
  employee_checked,
  cht_checked,
  asm_checked,
  score_achieved,
  final_classification
}
filter .employee_id = "EMP001"
order by .assessment_date desc;
```

### Get records with checklist hierarchy

```edgeql
select ChecklistRecord {
  checklist_item: {
    name,
    parent: { name }
  },
  employee_id,
  assessment_date,
  employee_checked,
  cht_checked,
  asm_checked,
  score_achieved
}
order by .assessment_date desc;
```

## Integration with Vue Application

### Example: Fetch Checklist Hierarchy

```typescript
// composables/useChecklist.ts
import { createClient } from 'edgedb';

const client = createClient();

export async function getChecklistHierarchy() {
  return await client.query(`
    select ChecklistItem {
      id,
      name,
      standard_score,
      classification,
      is_category,
      order,
      children: {
        id,
        name,
        standard_score,
        classification,
        order
      } order by .order
    }
    filter .is_category = true
    order by .order
  `);
}
```

### Example: Create Assessment Record

```typescript
export async function createAssessmentRecord(data: {
  checklistItemId: string;
  employeeId: string;
  assessmentDate: string;
  employeeChecked: boolean;
  chtChecked: boolean;
  asmChecked: boolean;
  achievementPercentage?: number;
  successfulCompletions?: number;
  implementationIssues?: string;
  scoreAchieved?: number;
  finalClassification?: string;
}) {
  return await client.query(`
    insert ChecklistRecord {
      checklist_item := <ChecklistItem><uuid>$checklistItemId,
      employee_id := <str>$employeeId,
      assessment_date := <cal::local_date>$assessmentDate,
      employee_checked := <bool>$employeeChecked,
      cht_checked := <bool>$chtChecked,
      asm_checked := <bool>$asmChecked,
      achievement_percentage := <optional float32>$achievementPercentage,
      successful_completions := <optional int32>$successfulCompletions,
      implementation_issues := <optional str>$implementationIssues,
      score_achieved := <optional float32>$scoreAchieved,
      final_classification := <optional str>$finalClassification
    }
  `, data);
}
```

### Example: Update Record

```typescript
export async function updateAssessmentRecord(
  recordId: string,
  updates: Partial<AssessmentRecordData>
) {
  return await client.query(`
    update ChecklistRecord
    filter .id = <uuid>$recordId
    set {
      employee_checked := <optional bool>$employeeChecked,
      cht_checked := <optional bool>$chtChecked,
      asm_checked := <optional bool>$asmChecked,
      achievement_percentage := <optional float32>$achievementPercentage,
      score_achieved := <optional float32>$scoreAchieved,
      updated_at := datetime_current()
    }
  `, { recordId, ...updates });
}
```

## Troubleshooting

### Reset Database

```bash
# Drop all data (careful!)
gel query "delete ChecklistRecord"
gel query "delete ChecklistItem"
gel query "delete Employee"

# Re-run seed data
gel query < dbschema/seed_data.edgeql
```

### Check Migration Status

```bash
gel migration status
```

### View Current Schema

```bash
gel describe schema
```

## Next Steps

1. ✅ Schema created
2. ✅ Seed data prepared
3. ⏳ Run migrations
4. ⏳ Load seed data
5. ⏳ Update Vue components to fetch from Geldata
6. ⏳ Implement CRUD operations in frontend
7. ⏳ Sync Univer spreadsheet with database

See `SCHEMA_DESIGN.md` for detailed schema documentation.
