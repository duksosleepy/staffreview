pnpm dlx gel migration create
gel migrate
gel query -f dbschema/seed_data.edgeql
gel query -f dbschema/criteria.edgeql
gel project unlink
gel instance destroy -I staffreview
gel configure set listen_addresses 0.0.0.0
gel instance link --trust-tls-cert
gel instance reset-password --password
gel query "delete ChecklistRecord; delete DetailMonthlyRecord; delete DetailChecklistItem; delete DetailCategory; delete Area; delete EmployeeSchedule;"
