CREATE MIGRATION m1ump6sqjqsdgaaswlqj26txlevxsetzsfmd2zkbyw2o6kpshqmwkq
    ONTO m1uqkejbqn6kq6wpkthgnwz75jezexp3ruxyrmgc3k2l3ob2yv4kpa
{
  ALTER TYPE default::DetailChecklistItem {
      DROP LINK task_assignments;
  };
  ALTER TYPE default::DetailChecklistItem {
      CREATE PROPERTY task_type: default::ShiftType;
  };
  ALTER TYPE default::EmployeeSchedule {
      CREATE REQUIRED PROPERTY hr_id: std::str {
          SET default := '';
      };
      ALTER PROPERTY store_id {
          SET REQUIRED USING (<std::str>{});
      };
      CREATE CONSTRAINT std::exclusive ON ((.hr_id, .store_id));
  };
  ALTER TYPE default::EmployeeSchedule {
      CREATE INDEX ON (.hr_id);
  };
  ALTER TYPE default::EmployeeSchedule {
      DROP INDEX ON (.employee_id);
      ALTER PROPERTY daily_schedule {
          SET default := (<array<std::str>>[]);
      };
      DROP PROPERTY employee_id;
  };
  ALTER TYPE default::EmployeeSchedule {
      CREATE REQUIRED PROPERTY employee_name: std::str {
          SET default := '';
      };
  };
  ALTER TYPE default::EmployeeSchedule {
      CREATE PROPERTY position: std::str;
  };
  ALTER TYPE default::EmployeeSchedule {
      CREATE PROPERTY region: std::str;
  };
  ALTER TYPE default::EmployeeSchedule {
      CREATE PROPERTY status: std::str;
  };
  DROP TYPE default::TaskAssignment;
};
