CREATE MIGRATION m1lmsvem6pstnlfuaok7kjaqkssyfejsf3s5yszcww7y3cggdh7kua
    ONTO m1jnnfbyxc6psysine7c5zdft4jq7avjfdwlkyr326jd5535xcjpza
{
  ALTER TYPE default::DetailCategory {
      CREATE PROPERTY classification_criteria: std::json {
          SET default := (std::to_json('{"thresholds": {"A": 8.0, "B": 5.0, "C": 3.0}}'));
      };
  };
};
