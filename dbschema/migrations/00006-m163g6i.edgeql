CREATE MIGRATION m163g6i73buhnatqlb7gnblg3xkqtvuxh6yzxafky4rmtus26kkwza
    ONTO m1lmsvem6pstnlfuaok7kjaqkssyfejsf3s5yszcww7y3cggdh7kua
{
  CREATE TYPE default::TaskAssignment {
      CREATE REQUIRED LINK checklist_item: default::DetailChecklistItem {
          ON TARGET DELETE DELETE SOURCE;
      };
      CREATE REQUIRED PROPERTY cht_id: std::str;
      CREATE REQUIRED PROPERTY employee_id: std::str;
      CREATE CONSTRAINT std::exclusive ON ((.checklist_item, .employee_id, .cht_id));
      CREATE INDEX ON (.cht_id);
      CREATE INDEX ON (.employee_id);
      CREATE INDEX ON (.checklist_item);
      CREATE PROPERTY store_id: std::str {
          SET default := '';
      };
      CREATE INDEX ON (.store_id);
      CREATE PROPERTY is_deleted: std::bool {
          SET default := false;
      };
      CREATE INDEX ON (.is_deleted);
      CREATE PROPERTY created_at: std::datetime {
          SET default := (std::datetime_current());
      };
      CREATE PROPERTY deleted_at: std::datetime;
      CREATE PROPERTY updated_at: std::datetime {
          SET default := (std::datetime_current());
      };
  };
  ALTER TYPE default::DetailChecklistItem {
      CREATE MULTI LINK task_assignments := (.<checklist_item[IS default::TaskAssignment]);
  };
};
