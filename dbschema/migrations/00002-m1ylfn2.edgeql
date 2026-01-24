CREATE MIGRATION m1ylfn2hx5ync7hlpxk6zyeqrqezm6xfjzjpo4mbldkkfx5abiuinq
    ONTO m1vspxsslts4jamux4jnhjo2gdigqyxm7n5a4h7a3g23zjjy74ybkq
{
  ALTER TYPE default::DetailChecklistItem {
      CREATE PROPERTY baseline: std::int32 {
          SET default := 1;
          CREATE CONSTRAINT std::min_value(1);
      };
  };
};
