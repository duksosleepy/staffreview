# ============================================================================
# EdgeDB Seed Data for Checklist System
# Generated from skeleton.xlsx data
# ============================================================================

# ============================================================================
# 1. INSERT EMPLOYEES
# ============================================================================
# Create employee with ID "1" and default email
insert Employee {
    employee_id := "1",
    email := "employee1@company.com"
};


# ============================================================================
# 2. INSERT CHECKLISTS (Parent containers for ChecklistItems)
# ============================================================================

# Checklist 1: CHECK LIST HẰNG NGÀY (Daily Checklist)
insert Checklist {
    name := "CHECK LIST HẰNG NGÀY",
    description := "Danh sách công việc cần kiểm tra hằng ngày"
};

# Checklist 2: CHECK LIST HẰNG TUẦN (Weekly Checklist)
insert Checklist {
    name := "CHECK LIST HẰNG TUẦN",
    description := "Danh sách công việc cần kiểm tra hằng tuần"
};

# Checklist 3: CHECK LIST HẰNG THÁNG (Monthly Checklist)
insert Checklist {
    name := "CHECK LIST HẰNG THÁNG",
    description := "Danh sách công việc cần kiểm tra hằng tháng"
};

# Checklist 4: XỬ LÝ KHI CÓ PHÁT SINH (Handle When Issues Arise)
insert Checklist {
    name := "XỬ LÝ KHI CÓ PHÁT SINH",
    description := "Danh sách công việc xử lý khi có phát sinh"
};


# ============================================================================
# 3. INSERT CHECKLIST ITEMS (Tasks under checklists)
# ============================================================================

# ---------- Items under "CHECK LIST HẰNG NGÀY" ----------
insert ChecklistItem {
    name := "Đánh giá sàng lọc những nhân sự có khả năng thăng tiến để tạo đội ngũ kế thừa; Tuyển dụng nhân sự thay thế.",
    checklist := (select Checklist filter .name = "CHECK LIST HẰNG NGÀY" limit 1),
    standard_score := 2,
    order := 1
};

insert ChecklistItem {
    name := "Đi làm đúng giờ, đúng lịch ca làm việc và lấy vân tay theo đúng quy định",
    checklist := (select Checklist filter .name = "CHECK LIST HẰNG NGÀY" limit 1),
    standard_score := 3,
    order := 2
};

insert ChecklistItem {
    name := "Đồng phục/ tác phong đúng quy định",
    checklist := (select Checklist filter .name = "CHECK LIST HẰNG NGÀY" limit 1),
    standard_score := 4,
    order := 3
};

insert ChecklistItem {
    name := "Kiểm soát việc thực hiện nội quy/quy định của NV",
    checklist := (select Checklist filter .name = "CHECK LIST HẰNG NGÀY" limit 1),
    standard_score := 5,
    order := 4
};

insert ChecklistItem {
    name := "Theo dõi chi phí quầy (đủ số lượng sử dụng tại CH/TT)",
    checklist := (select Checklist filter .name = "CHECK LIST HẰNG NGÀY" limit 1),
    standard_score := 5,
    order := 5
};


# ---------- Items under "CHECK LIST HẰNG TUẦN" ----------
insert ChecklistItem {
    name := "Theo dõi chỉ số điện, nước",
    checklist := (select Checklist filter .name = "CHECK LIST HẰNG TUẦN" limit 1),
    standard_score := 2,
    order := 1
};

insert ChecklistItem {
    name := "Họp nhân viên bán hàng/NT/CHT 01 lần/ tuần.",
    checklist := (select Checklist filter .name = "CHECK LIST HẰNG TUẦN" limit 1),
    standard_score := 2,
    order := 2
};

insert ChecklistItem {
    name := "Kiểm soát việc lưu trữ số sách giấy tờ, chứng từ, Giấy phép kinh doanh, Giấy phép PCCC.",
    checklist := (select Checklist filter .name = "CHECK LIST HẰNG TUẦN" limit 1),
    standard_score := 4,
    order := 3
};


# ---------- Items under "CHECK LIST HẰNG THÁNG" ----------
insert ChecklistItem {
    name := "Check lịch làm việc cho Nhân viên để đạt doanh thu.",
    checklist := (select Checklist filter .name = "CHECK LIST HẰNG THÁNG" limit 1),
    standard_score := 1,
    order := 1
};

insert ChecklistItem {
    name := "Đánh giá check list công việc của NV/NT/CHT",
    checklist := (select Checklist filter .name = "CHECK LIST HẰNG THÁNG" limit 1),
    standard_score := 2,
    order := 2
};

insert ChecklistItem {
    name := "Tuyển dụng và đào tạo nhân sự mới",
    checklist := (select Checklist filter .name = "CHECK LIST HẰNG THÁNG" limit 1),
    standard_score := 3,
    order := 3
};

insert ChecklistItem {
    name := "Kiểm tra báo cáo trình trạng hàng hóa hư hỏng về Cty. Đôn đốc các phòng ban",
    checklist := (select Checklist filter .name = "CHECK LIST HẰNG THÁNG" limit 1),
    standard_score := 4,
    order := 4
};

insert ChecklistItem {
    name := "Xác nhận thay tem/tag CTKM, báo cáo đầy đủ và kịp thời",
    checklist := (select Checklist filter .name = "CHECK LIST HẰNG THÁNG" limit 1),
    standard_score := 1,
    order := 5
};


# ---------- Items under "XỬ LÝ KHI CÓ PHÁT SINH" ----------
insert ChecklistItem {
    name := "Xử lý khiếu nại, đổi trả sản phẩm.",
    checklist := (select Checklist filter .name = "XỬ LÝ KHI CÓ PHÁT SINH" limit 1),
    standard_score := 1,
    order := 1
};

insert ChecklistItem {
    name := "Hỗ trợ thi công setup/ out quầy",
    checklist := (select Checklist filter .name = "XỬ LÝ KHI CÓ PHÁT SINH" limit 1),
    standard_score := 1,
    order := 2
};

insert ChecklistItem {
    name := "Báo cáo sự cố khi có phát sinh",
    checklist := (select Checklist filter .name = "XỬ LÝ KHI CÓ PHÁT SINH" limit 1),
    standard_score := 1,
    order := 3
};


# ============================================================================
# 4. CREATE A SHEET FOR THE EMPLOYEE
# ============================================================================
insert Sheet {
    employee := (select Employee filter .employee_id = "1" limit 1),
    name := "Employee 1 - January 2026 Checklist"
};


# ============================================================================
# 5. INSERT CHECKLIST RECORDS (Assessment data from Excel)
# ============================================================================
# Note: Only creating records for rows that have actual date values in the Excel file

# Record 1: Assessment on 2026-01-10
insert ChecklistRecord {
    sheet := (
        select Sheet
        filter .employee.employee_id = "1"
        and .name = "Employee 1 - January 2026 Checklist"
        limit 1
    ),
    checklist_item := (
        select ChecklistItem
        filter .name = "Đánh giá sàng lọc những nhân sự có khả năng thăng tiến để tạo đội ngũ kế thừa; Tuyển dụng nhân sự thay thế."
        limit 1
    ),
    employee := (select Employee filter .employee_id = "1" limit 1),
    assessment_date := <cal::local_date>'2026-01-10',
    employee_checked := true,
    cht_checked := true,
    asm_checked := true,
    final_classification := 'A'
};

# Record 2: Assessment on 2026-01-11
insert ChecklistRecord {
    sheet := (
        select Sheet
        filter .employee.employee_id = "1"
        and .name = "Employee 1 - January 2026 Checklist"
        limit 1
    ),
    checklist_item := (
        select ChecklistItem
        filter .name = "Đi làm đúng giờ, đúng lịch ca làm việc và lấy vân tay theo đúng quy định"
        limit 1
    ),
    employee := (select Employee filter .employee_id = "1" limit 1),
    assessment_date := <cal::local_date>'2026-01-11',
    employee_checked := true,
    cht_checked := true,
    asm_checked := true,
    final_classification := 'B'
};

# Record 3: Assessment on 2026-01-12
insert ChecklistRecord {
    sheet := (
        select Sheet
        filter .employee.employee_id = "1"
        and .name = "Employee 1 - January 2026 Checklist"
        limit 1
    ),
    checklist_item := (
        select ChecklistItem
        filter .name = "Đồng phục/ tác phong đúng quy định"
        limit 1
    ),
    employee := (select Employee filter .employee_id = "1" limit 1),
    assessment_date := <cal::local_date>'2026-01-12',
    employee_checked := false,
    cht_checked := false,
    asm_checked := false,
    final_classification := 'C'
};

# Record 4: Assessment on 2026-01-13
insert ChecklistRecord {
    sheet := (
        select Sheet
        filter .employee.employee_id = "1"
        and .name = "Employee 1 - January 2026 Checklist"
        limit 1
    ),
    checklist_item := (
        select ChecklistItem
        filter .name = "Kiểm soát việc thực hiện nội quy/quy định của NV"
        limit 1
    ),
    employee := (select Employee filter .employee_id = "1" limit 1),
    assessment_date := <cal::local_date>'2026-01-13',
    employee_checked := false,
    cht_checked := false,
    asm_checked := false,
    final_classification := 'D'
};

# Record 5: Assessment on 2026-01-14
insert ChecklistRecord {
    sheet := (
        select Sheet
        filter .employee.employee_id = "1"
        and .name = "Employee 1 - January 2026 Checklist"
        limit 1
    ),
    checklist_item := (
        select ChecklistItem
        filter .name = "Theo dõi chi phí quầy (đủ số lượng sử dụng tại CH/TT)"
        limit 1
    ),
    employee := (select Employee filter .employee_id = "1" limit 1),
    assessment_date := <cal::local_date>'2026-01-14',
    employee_checked := false,
    cht_checked := false,
    asm_checked := false
};


# ============================================================================
# VERIFICATION QUERIES (Optional - can be run separately to verify data)
# ============================================================================
# Uncomment these to verify your data after seeding:

# # Check all employees
# select Employee { employee_id, email };

# # Check all checklists with their items
# select Checklist {
#     name,
#     description,
#     items: {
#         name,
#         standard_score,
#         order
#     } order by .order
# };

# # Check all checklist items with their parent checklist
# select ChecklistItem {
#     name,
#     standard_score,
#     order,
#     checklist: { name }
# }
# order by .checklist.name then .order;

# # Check all sheets
# select Sheet {
#     name,
#     employee: { employee_id, email },
#     created_at
# };

# # Check all checklist records
# select ChecklistRecord {
#     assessment_date,
#     employee: { employee_id },
#     checklist_item: { name, checklist: { name } },
#     employee_checked,
#     cht_checked,
#     asm_checked,
#     final_classification,
#     sheet: { name }
# }
# order by .assessment_date;
