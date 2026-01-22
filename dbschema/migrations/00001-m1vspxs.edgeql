CREATE MIGRATION m1vspxsslts4jamux4jnhjo2gdigqyxm7n5a4h7a3g23zjjy74ybkq
    ONTO initial
{
  CREATE SCALAR TYPE default::DetailCategoryType EXTENDING enum<daily, weekly, monthly>;
  CREATE FUTURE no_linkful_computed_splats;
  CREATE TYPE default::ChecklistRecord {
      CREATE REQUIRED PROPERTY assessment_date: std::cal::local_date;
      CREATE REQUIRED PROPERTY staff_id: std::str;
      CREATE INDEX ON (.assessment_date);
      CREATE INDEX ON (.staff_id);
      CREATE PROPERTY final_classification: std::str {
          CREATE CONSTRAINT std::one_of('A', 'B', 'C', 'D', 'X');
      };
      CREATE INDEX ON (.final_classification);
      CREATE PROPERTY is_deleted: std::bool {
          SET default := false;
      };
      CREATE INDEX ON (.is_deleted);
      CREATE PROPERTY achievement_percentage: std::float32 {
          SET default := 0.0;
          CREATE CONSTRAINT std::max_value(100);
          CREATE CONSTRAINT std::min_value(0);
      };
      CREATE PROPERTY asm_checked: std::bool {
          SET default := false;
      };
      CREATE PROPERTY cht_checked: std::bool {
          SET default := false;
      };
      CREATE PROPERTY created_at: std::datetime {
          SET default := (std::datetime_current());
      };
      CREATE PROPERTY deleted_at: std::datetime;
      CREATE PROPERTY employee_checked: std::bool {
          SET default := false;
      };
      CREATE PROPERTY implementation_issues: std::str;
      CREATE PROPERTY score_achieved: std::float32 {
          SET default := 0.0;
          CREATE CONSTRAINT std::min_value(0);
      };
      CREATE PROPERTY successful_completions: std::int32 {
          SET default := 0;
          CREATE CONSTRAINT std::min_value(0);
      };
      CREATE PROPERTY updated_at: std::datetime {
          SET default := (std::datetime_current());
      };
  };
  CREATE TYPE default::DetailChecklistItem {
      CREATE REQUIRED PROPERTY item_number: std::int32 {
          CREATE CONSTRAINT std::min_value(1);
      };
      CREATE PROPERTY order: std::int32 {
          SET default := 0;
          CREATE CONSTRAINT std::min_value(0);
      };
      CREATE INDEX ON (.order);
      CREATE PROPERTY is_deleted: std::bool {
          SET default := false;
      };
      CREATE INDEX ON (.is_deleted);
      CREATE PROPERTY created_at: std::datetime {
          SET default := (std::datetime_current());
      };
      CREATE PROPERTY deleted_at: std::datetime;
      CREATE PROPERTY evaluator: std::str;
      CREATE REQUIRED PROPERTY name: std::str;
      CREATE PROPERTY notes: std::str;
      CREATE PROPERTY penalty_level_1: std::str;
      CREATE PROPERTY penalty_level_2: std::str;
      CREATE PROPERTY penalty_level_3: std::str;
      CREATE PROPERTY scope: std::str;
      CREATE REQUIRED PROPERTY score: std::int32 {
          SET default := 1;
          CREATE CONSTRAINT std::max_value(3);
          CREATE CONSTRAINT std::min_value(1);
      };
      CREATE PROPERTY time_frame: std::str;
      CREATE PROPERTY updated_at: std::datetime {
          SET default := (std::datetime_current());
      };
  };
  ALTER TYPE default::ChecklistRecord {
      CREATE REQUIRED LINK checklist_item: default::DetailChecklistItem {
          ON TARGET DELETE DELETE SOURCE;
      };
      CREATE CONSTRAINT std::exclusive ON ((.checklist_item, .staff_id, .assessment_date));
      CREATE INDEX ON (.checklist_item);
  };
  ALTER TYPE default::DetailChecklistItem {
      CREATE MULTI LINK checklist_records := (.<checklist_item[IS default::ChecklistRecord]);
  };
  CREATE TYPE default::DetailCategory {
      CREATE PROPERTY order: std::int32 {
          SET default := 0;
          CREATE CONSTRAINT std::min_value(0);
      };
      CREATE INDEX ON (.order);
      CREATE REQUIRED PROPERTY category_type: default::DetailCategoryType;
      CREATE INDEX ON (.category_type);
      CREATE PROPERTY created_at: std::datetime {
          SET default := (std::datetime_current());
      };
      CREATE PROPERTY description: std::str;
      CREATE REQUIRED PROPERTY name: std::str {
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE PROPERTY updated_at: std::datetime {
          SET default := (std::datetime_current());
      };
  };
  ALTER TYPE default::DetailChecklistItem {
      CREATE REQUIRED LINK category: default::DetailCategory {
          ON TARGET DELETE DELETE SOURCE;
      };
      CREATE CONSTRAINT std::exclusive ON ((.item_number, .category));
      CREATE INDEX ON (.category);
  };
  ALTER TYPE default::DetailCategory {
      CREATE MULTI LINK items := (.<category[IS default::DetailChecklistItem]);
  };
  CREATE TYPE default::DetailMonthlyRecord {
      CREATE REQUIRED LINK detail_item: default::DetailChecklistItem {
          ON TARGET DELETE DELETE SOURCE;
      };
      CREATE REQUIRED PROPERTY month: std::int32 {
          CREATE CONSTRAINT std::max_value(12);
          CREATE CONSTRAINT std::min_value(1);
      };
      CREATE REQUIRED PROPERTY staff_id: std::str;
      CREATE REQUIRED PROPERTY year: std::int32 {
          CREATE CONSTRAINT std::min_value(2020);
      };
      CREATE CONSTRAINT std::exclusive ON ((.detail_item, .staff_id, .month, .year));
      CREATE INDEX ON (.detail_item);
      CREATE INDEX ON ((.month, .year));
      CREATE INDEX ON (.staff_id);
      CREATE PROPERTY classification: std::str {
          CREATE CONSTRAINT std::one_of('A', 'B', 'C', 'D', 'KHONG_DAT');
      };
      CREATE INDEX ON (.classification);
      CREATE PROPERTY is_deleted: std::bool {
          SET default := false;
      };
      CREATE INDEX ON (.is_deleted);
      CREATE PROPERTY achievement_percentage: std::float32 {
          SET default := 0.0;
          CREATE CONSTRAINT std::max_value(100);
          CREATE CONSTRAINT std::min_value(0);
      };
      CREATE PROPERTY created_at: std::datetime {
          SET default := (std::datetime_current());
      };
      CREATE PROPERTY daily_checks: array<std::bool>;
      CREATE PROPERTY deleted_at: std::datetime;
      CREATE PROPERTY implementation_issues_count: std::int32 {
          SET default := 0;
          CREATE CONSTRAINT std::min_value(0);
      };
      CREATE PROPERTY notes: std::str;
      CREATE PROPERTY score_achieved: std::float32 {
          SET default := 0.0;
          CREATE CONSTRAINT std::min_value(0);
      };
      CREATE PROPERTY successful_completions: std::int32 {
          SET default := 0;
          CREATE CONSTRAINT std::min_value(0);
      };
      CREATE PROPERTY updated_at: std::datetime {
          SET default := (std::datetime_current());
      };
  };
  ALTER TYPE default::DetailChecklistItem {
      CREATE MULTI LINK monthly_records := (.<detail_item[IS default::DetailMonthlyRecord]);
  };
};
