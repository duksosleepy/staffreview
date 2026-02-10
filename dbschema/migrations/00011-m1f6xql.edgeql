CREATE MIGRATION m1f6xqlhhnyc4d3uvoiuvaxckg2ikaelj2xhh2whvolhynyb7jjmha
    ONTO m1u6lvrabb7bxjanblgzger35ixzcrshda42pui4f5ook5k3f3zxca
{
  CREATE TYPE default::EmployeeMonthlyScore {
      CREATE REQUIRED PROPERTY month: std::int32 {
          CREATE CONSTRAINT std::max_value(12);
          CREATE CONSTRAINT std::min_value(1);
      };
      CREATE REQUIRED PROPERTY staff_id: std::str;
      CREATE REQUIRED PROPERTY year: std::int32 {
          CREATE CONSTRAINT std::min_value(2020);
      };
      CREATE CONSTRAINT std::exclusive ON ((.staff_id, .month, .year));
      CREATE INDEX ON ((.month, .year));
      CREATE INDEX ON (.staff_id);
      CREATE REQUIRED PROPERTY store_id: std::str;
      CREATE INDEX ON (.store_id);
      CREATE PROPERTY created_at: std::datetime {
          SET default := (std::datetime_current());
      };
      CREATE PROPERTY final_classification: std::str {
          SET default := 'D';
      };
      CREATE PROPERTY total_score: std::float32 {
          SET default := 0.0;
          CREATE CONSTRAINT std::min_value(0);
      };
      CREATE PROPERTY updated_at: std::datetime {
          SET default := (std::datetime_current());
      };
  };
};
