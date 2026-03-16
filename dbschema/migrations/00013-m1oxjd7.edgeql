CREATE MIGRATION m1oxjd7f5vjh23hx43qnh72lwzoybng4674rnqq3vpm7c7srxufauq
    ONTO m1lp42jj3mcfc3zmufpdxim7c3w4wbwhacalydthytx3xwwenu275q
{
  ALTER TYPE default::DetailChecklistItem {
      DROP PROPERTY owner;
  };
  ALTER TYPE default::DetailChecklistItem {
      CREATE MULTI PROPERTY owners: std::str {
          CREATE CONSTRAINT std::one_of('asm', 'cht', 'employee');
      };
  };
};
