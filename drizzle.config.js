export default {
  dialect: "postgresql",
  schema: "./utils/db/schema.ts",
  out: "./drizzle",

  dbCredentials: {
    url: "postgresql://neondb_owner:npg_WiRfx2eXPqh4@ep-empty-sky-aakqdgqt.westus3.azure.neon.tech/neondb?sslmode=require",
    connectionString: "postgresql://neondb_owner:npg_WiRfx2eXPqh4@ep-empty-sky-aakqdgqt.westus3.azure.neon.tech/neondb?sslmode=require",
  },
};
