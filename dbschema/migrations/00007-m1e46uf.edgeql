CREATE MIGRATION m1e46ufmebw6lon4jrje5xvdounawtwwysm7pczbzb6iykecnufg3a
    ONTO m163g6i73buhnatqlb7gnblg3xkqtvuxh6yzxafky4rmtus26kkwza
{
  CREATE TYPE default::EmployeeSchedule {
      CREATE REQUIRED PROPERTY employee_id: std::str {
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE INDEX ON (.employee_id);
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
      CREATE PROPERTY daily_schedule: array<std::str>;
      CREATE PROPERTY deleted_at: std::datetime;
      CREATE PROPERTY updated_at: std::datetime {
          SET default := (std::datetime_current());
      };
  };
};
