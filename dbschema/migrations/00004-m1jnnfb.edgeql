CREATE MIGRATION m1jnnfbyxc6psysine7c5zdft4jq7avjfdwlkyr326jd5535xcjpza
    ONTO m1tz6ih5m4erubfotcycg6a57lt2jnkqrf5c74lnypxxszx7kttuga
{
  ALTER TYPE default::ChecklistRecord {
      CREATE PROPERTY asm_checked_at: std::datetime;
      CREATE PROPERTY cht_checked_at: std::datetime;
      CREATE PROPERTY deadline_date: std::cal::local_date;
      CREATE PROPERTY employee_checked_at: std::datetime;
      CREATE PROPERTY is_locked: std::bool {
          SET default := false;
      };
      CREATE PROPERTY locked_at: std::datetime;
  };
};
