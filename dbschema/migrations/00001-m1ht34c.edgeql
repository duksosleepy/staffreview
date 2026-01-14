CREATE MIGRATION m1ht34c4lquxvq4g3bxwrsxg575vpuea32y2sewbfnpmvzdw7x5iaa
    ONTO initial
{
  CREATE FUTURE no_linkful_computed_splats;
  CREATE TYPE default::ChecklistItem {
      CREATE LINK parent: default::ChecklistItem {
          ON TARGET DELETE ALLOW;
      };
      CREATE REQUIRED PROPERTY name: std::str;
      CREATE CONSTRAINT std::exclusive ON ((.name, .parent));
      CREATE PROPERTY order: std::int32 {
          SET default := 0;
          CREATE CONSTRAINT std::min_value(0);
      };
      CREATE INDEX ON (.order);
      CREATE PROPERTY is_category: std::bool {
          SET default := false;
      };
      CREATE INDEX ON (.is_category);
      CREATE INDEX ON (.parent);
      CREATE PROPERTY is_deleted: std::bool {
          SET default := false;
      };
      CREATE INDEX ON (.is_deleted);
      CREATE MULTI LINK children := (.<parent[IS default::ChecklistItem]);
      CREATE PROPERTY created_at: std::datetime {
          SET default := (std::datetime_current());
      };
      CREATE PROPERTY deleted_at: std::datetime;
      CREATE PROPERTY standard_score: std::int32 {
          CREATE CONSTRAINT std::max_value(100);
          CREATE CONSTRAINT std::min_value(0);
      };
      CREATE PROPERTY updated_at: std::datetime {
          SET default := (std::datetime_current());
      };
  };
  CREATE TYPE default::Employee {
      CREATE REQUIRED PROPERTY email: std::str;
      CREATE REQUIRED PROPERTY employee_id: std::str {
          CREATE CONSTRAINT std::exclusive;
      };
  };
  CREATE TYPE default::ChecklistRecord {
      CREATE REQUIRED LINK checklist_item: default::ChecklistItem {
          ON TARGET DELETE DELETE SOURCE;
      };
      CREATE REQUIRED LINK employee: default::Employee {
          ON TARGET DELETE DELETE SOURCE;
      };
      CREATE REQUIRED PROPERTY assessment_date: std::cal::local_date;
      CREATE CONSTRAINT std::exclusive ON ((.checklist_item, .employee, .assessment_date));
      CREATE INDEX ON (.checklist_item);
      CREATE INDEX ON (.assessment_date);
      CREATE PROPERTY final_classification: std::str {
          CREATE CONSTRAINT std::one_of('A', 'B', 'C', 'D', 'X');
      };
      CREATE INDEX ON (.final_classification);
      CREATE INDEX ON (.employee);
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
  ALTER TYPE default::ChecklistItem {
      CREATE MULTI LINK records := (.<checklist_item[IS default::ChecklistRecord]);
  };
  CREATE TYPE default::Sheet {
      CREATE REQUIRED LINK employee: default::Employee {
          ON TARGET DELETE DELETE SOURCE;
      };
      CREATE INDEX ON (.employee);
      CREATE PROPERTY created_at: std::datetime {
          SET default := (std::datetime_current());
      };
      CREATE PROPERTY name: std::str;
      CREATE PROPERTY updated_at: std::datetime {
          SET default := (std::datetime_current());
      };
  };
  ALTER TYPE default::ChecklistRecord {
      CREATE REQUIRED LINK sheet: default::Sheet {
          ON TARGET DELETE DELETE SOURCE;
      };
      CREATE INDEX ON (.sheet);
  };
  ALTER TYPE default::Sheet {
      CREATE MULTI LINK records := (.<sheet[IS default::ChecklistRecord]);
  };
};
