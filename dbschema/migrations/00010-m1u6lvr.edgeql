CREATE MIGRATION m1u6lvrabb7bxjanblgzger35ixzcrshda42pui4f5ook5k3f3zxca
    ONTO m1ump6sqjqsdgaaswlqj26txlevxsetzsfmd2zkbyw2o6kpshqmwkq
{
  ALTER TYPE default::DetailChecklistItem {
      CREATE PROPERTY owner: std::str {
          CREATE CONSTRAINT std::one_of('asm', 'cht', 'employee');
      };
  };
};
