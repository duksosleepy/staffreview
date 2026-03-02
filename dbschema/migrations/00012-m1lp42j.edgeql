CREATE MIGRATION m1lp42jj3mcfc3zmufpdxim7c3w4wbwhacalydthytx3xwwenu275q
    ONTO m1f6xqlhhnyc4d3uvoiuvaxckg2ikaelj2xhh2whvolhynyb7jjmha
{
  ALTER TYPE default::DetailChecklistItem {
      CREATE PROPERTY applicable_days: array<std::int32>;
  };
};
