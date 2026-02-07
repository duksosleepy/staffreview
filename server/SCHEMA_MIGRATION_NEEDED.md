# EmployeeSchedule Schema Migration Needed

## ⚠️ CRITICAL CHANGE: No More Casdoor User Matching!

The system now stores employee data **directly from Excel** without matching to Casdoor users.

## Required Schema Changes

Update the `EmployeeSchedule` type in your EdgeDB schema:

```edgeql
type EmployeeSchedule {
  # PRIMARY IDENTIFIER - Changed from employee_id to hr_id
  required hr_id: str;              # ID HRM from Excel (Primary identifier)
  required employee_name: str;       # HỌ VÀ TÊN (dấu) from Excel
  required store_id: str;            # Mã bộ phận (Department Code)
  required daily_schedule: array<str>; # N1-N31 (31 strings)

  # METADATA FROM EXCEL
  region: str;                       # Miền
  position: str;                     # Mã chức vụ
  status: str;                       # TRẠNG THÁI NHÂN VIÊN

  # SYSTEM FIELDS
  created_at: datetime;
  updated_at: datetime;
  is_deleted: bool;

  # ADD INDEX for performance
  index on (.hr_id);
  index on (.store_id);
}
```

## How to Apply

If using EdgeDB CLI:

```bash
cd server
edgedb migration create
edgedb migrate
```

If using Geldata:

```bash
cd server
npx gel schema:push
```

## What's Changed

### ✅ Backend API (`/server/src/routes/schedules.ts`)
- Changed from `employee_id` → `hr_id` as primary identifier
- Added `employee_name`, `status` fields
- Queries filter by `hr_id + store_id` (not Casdoor user ID)

### ✅ Frontend Types (`/frontend/src/lib/gel-client.ts`)
- Updated `EmployeeSchedule` type to use `hr_id` and `employee_name`
- Updated `UpsertSchedulePayload` to match new schema

### ✅ Excel Import (`/frontend/src/pages/SheetPage.vue`)
- **REMOVED Casdoor user matching** - no more "employee not found" errors!
- Directly saves all Excel data to database
- Uses HR ID as identifier

### ❌ **Database Schema - YOU MUST RUN MIGRATION**

## Migration Impact

### Before (❌ Old):
1. Upload Excel → Match employee names with Casdoor users
2. If name doesn't match → Error: "Không tìm thấy nhân viên"
3. Only saves schedules for matched users

### After (✅ New):
1. Upload Excel → Extract ALL data directly
2. Save to database using HR ID as identifier
3. No Casdoor matching required!

## Notes

- `store_id` = department code from Excel ("Mã bộ phận")
- `hr_id` = ID HRM from Excel (Primary identifier)
- CHT's `CUAHANG` = department code
- Backend filters by `store_id == CHT's CUAHANG`
- Sheet 3 shows only employees from CHT's department (no ASM)
