CREATE MIGRATION m1tz6ih5m4erubfotcycg6a57lt2jnkqrf5c74lnypxxszx7kttuga
    ONTO m1ylfn2hx5ync7hlpxk6zyeqrqezm6xfjzjpo4mbldkkfx5abiuinq
{
  CREATE TYPE default::Area {
      CREATE REQUIRED PROPERTY region: std::str;
      CREATE INDEX ON (.region);
      CREATE PROPERTY created_at: std::datetime {
          SET default := (std::datetime_current());
      };
      CREATE REQUIRED PROPERTY store_id: std::str {
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE PROPERTY updated_at: std::datetime {
          SET default := (std::datetime_current());
      };
  };
  ALTER TYPE default::ChecklistRecord {
      CREATE PROPERTY store_id: std::str {
          SET default := '';
      };
      CREATE INDEX ON (.store_id);
  };
  ALTER TYPE default::DetailMonthlyRecord {
      CREATE PROPERTY store_id: std::str {
          SET default := '';
      };
      CREATE INDEX ON (.store_id);
  };
};
