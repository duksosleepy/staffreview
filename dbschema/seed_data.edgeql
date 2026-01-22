# ============================================================================
# EdgeDB Seed Data for Unified Checklist System
# Both Sheet 1 and Sheet 2 now share DetailChecklistItem as the item source
# ============================================================================


# ============================================================================
# 1. INSERT DETAIL CATEGORIES (Shared by both sheets)
# ============================================================================

insert DetailCategory {
    name := "CHECK LIST HẰNG NGÀY CHI TIẾT",
    category_type := DetailCategoryType.daily,
    description := "Danh sách công việc kiểm tra hằng ngày chi tiết",
    order := 1
};

insert DetailCategory {
    name := "CHECK LIST HẰNG TUẦN CHI TIẾT",
    category_type := DetailCategoryType.weekly,
    description := "Danh sách công việc kiểm tra hằng tuần chi tiết",
    order := 2
};

insert DetailCategory {
    name := "CHECK LIST HẰNG THÁNG CHI TIẾT",
    category_type := DetailCategoryType.monthly,
    description := "Danh sách công việc kiểm tra hằng tháng chi tiết",
    order := 3
};


# ============================================================================
# 2. INSERT DETAIL CHECKLIST ITEMS - CHECK LIST HẰNG NGÀY (19 items)
# These items are shared by both Sheet 1 and Sheet 2
# ============================================================================

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG NGÀY CHI TIẾT" limit 1),
    item_number := 1,
    name := "Đi làm đúng giờ và lấy vân tay theo đúng quy định",
    evaluator := "ADMIN",
    scope := "ALL",
    time_frame := "NP: 9H\n CH KHÁC THEO LỊCH CỦA TTTM",
    penalty_level_1 := "Theo quy định công",
    penalty_level_2 := "Theo quy định công",
    penalty_level_3 := "Theo quy định công",
    score := 3,
    order := 1
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG NGÀY CHI TIẾT" limit 1),
    item_number := 2,
    name := "Đồng phục/ tác phong đúng quy định",
    evaluator := "ADMIN",
    scope := "ALL",
    time_frame := "FULL GIỜ",
    penalty_level_1 := "50",
    penalty_level_2 := "100",
    penalty_level_3 := "100% TN",
    score := 3,
    order := 2
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG NGÀY CHI TIẾT" limit 1),
    item_number := 3,
    name := "Vệ sinh cửa hàng theo quy định\n - Lau cửa kính, \n - Show window\n - Vật dụng, thiết bị CCDC\n - Quầy kệ\n - Nhà vệ sinh,…",
    evaluator := "ADMIN",
    scope := "ALL",
    time_frame := "30 phút đầu giờ",
    penalty_level_1 := "50",
    penalty_level_2 := "100",
    penalty_level_3 := "100% TN",
    score := 3,
    order := 3
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG NGÀY CHI TIẾT" limit 1),
    item_number := 4,
    name := "Mở các trang thiết bị khi vào ca (máy tính, đèn, máy lạnh)",
    evaluator := "CAMERA",
    scope := "ALL",
    time_frame := "5 phút đầu ngày",
    penalty_level_1 := "50",
    penalty_level_2 := "100",
    penalty_level_3 := "50% TN",
    score := 1,
    order := 4
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG NGÀY CHI TIẾT" limit 1),
    item_number := 5,
    name := "Tắt máy lạnh trước khi về 30 phút",
    evaluator := "CAMERA",
    scope := "NP",
    time_frame := "30 Phút trước khi về",
    penalty_level_1 := "50",
    penalty_level_2 := "100",
    penalty_level_3 := "50% TN",
    score := 1,
    order := 5
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG NGÀY CHI TIẾT" limit 1),
    item_number := 6,
    name := "Mở trình chiếu clip/tivi CTKM trước khi chạy CTKM\n Gửi hình ảnh/video báo cáo qua lark\n - Nhà phố trước 17h30\n - TTTM trước 10h30",
    evaluator := "MKT",
    scope := "CH có Led/Tivi",
    time_frame := "TTTM: 10:00-22:00\n NP: 17-22",
    penalty_level_1 := "100",
    penalty_level_2 := "200",
    penalty_level_3 := "50% TN",
    score := 2,
    order := 6
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG NGÀY CHI TIẾT" limit 1),
    item_number := 7,
    name := "Mở đèn bên ngoài mặt tiền (bao gồm bảng hiệu/ logo), đèn ray theo quy định",
    evaluator := "CAMERA",
    scope := "ALL",
    time_frame := "18:00:00-22:00",
    penalty_level_1 := "100",
    penalty_level_2 := "200",
    penalty_level_3 := "50% TN",
    score := 3,
    order := 7
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG NGÀY CHI TIẾT" limit 1),
    item_number := 8,
    name := "Tắt các thiết bị khi ra về (máy tính, tivi/led). Khóa cửa hàng",
    evaluator := "CAMERA",
    scope := "ALL",
    time_frame := "Kết thúc ca làm việc",
    penalty_level_1 := "30% TN",
    penalty_level_2 := "50% TN",
    penalty_level_3 := "100% TN",
    score := 3,
    order := 8
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG NGÀY CHI TIẾT" limit 1),
    item_number := 9,
    name := "Kiểm soát số lượng hàng hóa hàng ngày, để tránh xảy ra mất mát, hư hỏng trong quá trình bán hàng và bàn giao ca",
    evaluator := "ADMIN",
    scope := "ALL",
    time_frame := "Ra/Vào ca làm việc",
    penalty_level_1 := "30% TN",
    penalty_level_2 := "50% TN",
    penalty_level_3 := "100% TN",
    score := 3,
    order := 9
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG NGÀY CHI TIẾT" limit 1),
    item_number := 10,
    name := "Kiểm tra báo cáo các trang thiết bị/tài sản bị hư hỏng, mất nếu có",
    evaluator := "IT",
    scope := "ALL",
    time_frame := "30 phút đầu giờ",
    penalty_level_1 := "20% TN",
    penalty_level_2 := "30% TN",
    penalty_level_3 := "50% TN",
    score := 3,
    order := 10
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG NGÀY CHI TIẾT" limit 1),
    item_number := 11,
    name := "Cập nhật số kiểm hàng tổng, bàn giao kết ca.",
    evaluator := "KTAD",
    scope := "ALL",
    time_frame := "Ra/Vào ca làm việc",
    penalty_level_1 := "100",
    penalty_level_2 := "200",
    penalty_level_3 := "50% TN",
    score := 2,
    order := 11
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG NGÀY CHI TIẾT" limit 1),
    item_number := 12,
    name := "Trưng bày, sắp xếp, bảo quản, vệ sinh bảng sale, hàng hóa, tem giá đúng theo guiline, quy định tại cửa hàng và kho",
    evaluator := "MKT",
    scope := "ALL",
    time_frame := "Hàng ngày",
    penalty_level_1 := "30% TN",
    penalty_level_2 := "50% TN",
    penalty_level_3 := "100% TN",
    score := 3,
    order := 12
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG NGÀY CHI TIẾT" limit 1),
    item_number := 13,
    name := "Phát loa CTKM trước khi chạy CTKM",
    evaluator := "MKT",
    scope := "ALL \n (Trừ ch đặc biệt)",
    time_frame := "GO/ TTTM: full giờ\n NP: 17h-21h",
    penalty_level_1 := "100",
    penalty_level_2 := "200",
    penalty_level_3 := "50% TN",
    score := 2,
    order := 13
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG NGÀY CHI TIẾT" limit 1),
    item_number := 14,
    name := "Tiếp khách và tư vấn khách hàng",
    evaluator := "ADMIN",
    scope := "ALL",
    time_frame := "Full giờ",
    penalty_level_1 := "20% TN",
    penalty_level_2 := "30% TN",
    penalty_level_3 := "50% TN",
    score := 2,
    order := 14
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG NGÀY CHI TIẾT" limit 1),
    item_number := 15,
    name := "Báo cáo doanh thu hằng ngày đúng giờ, sổ sách đầy đủ",
    evaluator := "KTDT",
    scope := "ALL",
    time_frame := "Trước 23h",
    penalty_level_1 := "100",
    penalty_level_2 := "200",
    penalty_level_3 := "50% TN",
    score := 3,
    order := 15
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG NGÀY CHI TIẾT" limit 1),
    item_number := 16,
    name := "Chụp hình và gởi bill BLK kèm tem tag + chứng từ kèm theo nếu có",
    evaluator := "KTDT",
    scope := "ALL",
    time_frame := "Trước 23h",
    penalty_level_1 := "100",
    penalty_level_2 := "200",
    penalty_level_3 := "50% TN",
    score := 2,
    order := 16
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG NGÀY CHI TIẾT" limit 1),
    item_number := 17,
    name := "Nộp tiền đúng thời gian quy định\n Note rõ tên CH",
    evaluator := "KTCN",
    scope := "ALL",
    time_frame := "Trước 11h ngày hôm sau",
    penalty_level_1 := "100",
    penalty_level_2 := "200",
    penalty_level_3 := "50% TN",
    score := 3,
    order := 17
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG NGÀY CHI TIẾT" limit 1),
    item_number := 18,
    name := "Check mail phản hồi thông tin đúng thời gian quy định cho các bộ phận",
    evaluator := "ADMIN",
    scope := "ALL",
    time_frame := "Hàng ngày \n  9H00-10H00",
    penalty_level_1 := "100",
    penalty_level_2 := "200",
    penalty_level_3 := "50% TN",
    score := 1,
    order := 18
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG NGÀY CHI TIẾT" limit 1),
    item_number := 19,
    name := "Chụp phiếu xác nhận doanh thu từ TTTM gửi qua mail: ketoan@sangtam.com cho KT thuế xuất hóa đơn",
    evaluator := "KẾ TOÁN THUẾ",
    scope := "Đối với TTTM Lotte (Lotte Kim Mã + Lotte Tây Hồ)",
    time_frame := "Hàng ngày\n (9h-10h)",
    penalty_level_1 := "50",
    penalty_level_2 := "100",
    penalty_level_3 := "200",
    score := 1,
    order := 19
};


# ============================================================================
# 3. INSERT DETAIL CHECKLIST ITEMS - CHECK LIST HẰNG TUẦN (4 items)
# ============================================================================

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG TUẦN CHI TIẾT" limit 1),
    item_number := 1,
    name := "Đăng bài GGB và báo cáo đầy đủ, đúng quy định  (1 tuần /1 lần)",
    evaluator := "MKT",
    scope := "CH có tài khoản GGB/facebook",
    time_frame := "CH có tài khoản GGB/facebook",
    penalty_level_1 := "50",
    penalty_level_2 := "100",
    penalty_level_3 := "200",
    score := 1,
    order := 1
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG TUẦN CHI TIẾT" limit 1),
    item_number := 2,
    name := "Đăng bài facebook báo cáo đầy đủ, đúng quy định (1 tháng /4 lần)",
    evaluator := "MKT",
    scope := "CH có tài khoản GGB/facebook",
    time_frame := "CH có tài khoản GGB/facebook",
    penalty_level_1 := "50",
    penalty_level_2 := "100",
    penalty_level_3 := "200",
    score := 1,
    order := 2
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG TUẦN CHI TIẾT" limit 1),
    item_number := 3,
    name := "Báo cáo hình ảnh trưng bày CTKM, bảng sale",
    evaluator := "MKT",
    scope := "T2+T6 Hàng tuần",
    time_frame := "Chiều: 12 - 17h",
    penalty_level_1 := "100",
    penalty_level_2 := "200",
    penalty_level_3 := "50% TN",
    score := 3,
    order := 3
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG TUẦN CHI TIẾT" limit 1),
    item_number := 4,
    name := "Chụp hình biên bản đối chiếu công nợ từ trung tâm và các chứng từ liên quan khác gửi về mail ketoan@sangtam.com. Sau đó gửi bưu điện về Cty",
    evaluator := "KẾ TOÁN THUẾ",
    scope := "Cửa hàng nhận trả kỳ",
    time_frame := "Theo giờ hoạt động tại cửa hàng",
    penalty_level_1 := "50",
    penalty_level_2 := "100",
    penalty_level_3 := "200",
    score := 1,
    order := 4
};


# ============================================================================
# 4. INSERT DETAIL CHECKLIST ITEMS - CHECK LIST HẰNG THÁNG (22 items)
# ============================================================================

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG THÁNG CHI TIẾT" limit 1),
    item_number := 1,
    name := "Báo cáo số lượng, hình ảnh, trình trạng hàng hóa hư hỏng về Cty (1Tháng 2lần)",
    evaluator := "KTAD",
    scope := "ALL",
    time_frame := "Khi hư hỏng",
    penalty_level_1 := "100",
    penalty_level_2 := "200",
    penalty_level_3 := "50% TN",
    score := 3,
    order := 1
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG THÁNG CHI TIẾT" limit 1),
    item_number := 2,
    name := "Thay tem/tag CTKM, báo cáo đầy đủ và kịp thời (1Thang/2-4 lần)",
    evaluator := "KTAD",
    scope := "ALL",
    time_frame := "Khi có BB thay tem\n Full :9h-22h",
    penalty_level_1 := "100",
    penalty_level_2 := "200",
    penalty_level_3 := "50% TN",
    score := 3,
    order := 2
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG THÁNG CHI TIẾT" limit 1),
    item_number := 3,
    name := "Cung cấp đầy đủ thông tin xuất hóa đơn đỏ",
    evaluator := "KẾ TOÁN THUẾ",
    scope := "ALL",
    time_frame := "Sáng: 8h - 12h,\n Chiều: 12 - 17h30",
    penalty_level_1 := "50",
    penalty_level_2 := "100",
    penalty_level_3 := "200",
    score := 1,
    order := 3
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG THÁNG CHI TIẾT" limit 1),
    item_number := 4,
    name := "Fix lỗi những hạn mục thi công nhỏ",
    evaluator := "THI CÔNG",
    scope := "ALL",
    time_frame := "Khi có hư hỏng",
    penalty_level_1 := "50",
    penalty_level_2 := "100",
    penalty_level_3 := "200",
    score := 1,
    order := 4
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG THÁNG CHI TIẾT" limit 1),
    item_number := 5,
    name := "Hỗ trợ thi công setup/ out quầy",
    evaluator := "THI CÔNG",
    scope := "ALL",
    time_frame := "NP: 9H00-22h00\n TTTM: Sau 22h00",
    penalty_level_1 := "100",
    penalty_level_2 := "200",
    penalty_level_3 := "50% TN",
    score := 2,
    order := 5
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG THÁNG CHI TIẾT" limit 1),
    item_number := 6,
    name := "Hoạt náo theo quy định hàng tháng (trưng bày outlet, bóng bay, tờ rơi, phát loa,...) & xử lý báo cáo trên lark",
    evaluator := "MKT",
    scope := "ALL",
    time_frame := "Trưa 12h - 17h & tối 17h - 22h\n NP: 17-19h",
    penalty_level_1 := "100",
    penalty_level_2 := "200",
    penalty_level_3 := "50% TN",
    score := 3,
    order := 6
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG THÁNG CHI TIẾT" limit 1),
    item_number := 7,
    name := "Order bảng sale bổ sung khi thiếu/ hư hỏng",
    evaluator := "MKT",
    scope := "ALL",
    time_frame := "14h-17h",
    penalty_level_1 := "100",
    penalty_level_2 := "200",
    penalty_level_3 := "50% TN",
    score := 3,
    order := 7
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG THÁNG CHI TIẾT" limit 1),
    item_number := 8,
    name := "Trả lời phản hồi của khách hàng trên GGB",
    evaluator := "MKT",
    scope := "ALL",
    time_frame := "Phát sinh nếu có complant xử lý liền",
    penalty_level_1 := "50",
    penalty_level_2 := "100",
    penalty_level_3 := "200",
    score := 2,
    order := 8
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG THÁNG CHI TIẾT" limit 1),
    item_number := 9,
    name := "Bảo hành (Nhận hàng, kiểm tra, lập phiếu, sửa chữa, bảo quản và bàn giao cho khách kịp thời)",
    evaluator := "KHO",
    scope := "ALL",
    time_frame := "9h-17h",
    penalty_level_1 := "100",
    penalty_level_2 := "200",
    penalty_level_3 := "50% TN",
    score := 2,
    order := 9
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG THÁNG CHI TIẾT" limit 1),
    item_number := 10,
    name := "Báo cáo sự cố khi có phát sinh",
    evaluator := "IT/ THI CÔNG/ ADMIN",
    scope := "ALL",
    time_frame := "Khi phát sinh",
    penalty_level_1 := "20% TN",
    penalty_level_2 := "30% TN",
    penalty_level_3 := "50% TN",
    score := 3,
    order := 10
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG THÁNG CHI TIẾT" limit 1),
    item_number := 11,
    name := "Làm thẻ kho và sổ theo dõi nhập xuất tồn kho",
    evaluator := "KTDT",
    scope := "ALL",
    time_frame := "Mõi ngày từ 10h-12h",
    penalty_level_1 := "100",
    penalty_level_2 := "200",
    penalty_level_3 := "50% TN",
    score := 2,
    order := 11
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG THÁNG CHI TIẾT" limit 1),
    item_number := 12,
    name := "Vệ sinh kho: Quầy kệ, CCDC/ trang thiết bị\n Hàng hóa: bảo quản, vệ sinh hàng hóa theo quy định",
    evaluator := "CAMERA/ADMIN",
    scope := "ALL",
    time_frame := "Thứ 2 hàng tuần \n (14h-16h)",
    penalty_level_1 := "100",
    penalty_level_2 := "200",
    penalty_level_3 := "50% TN",
    score := 2,
    order := 12
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG THÁNG CHI TIẾT" limit 1),
    item_number := 13,
    name := "Đối chiếu và giải trình số lượng tồn kho định kỳ",
    evaluator := "KTDT",
    scope := "ALL",
    time_frame := "10h-12h\n 15 tây hoặc 30/31 tây",
    penalty_level_1 := "100",
    penalty_level_2 := "200",
    penalty_level_3 := "50% TN",
    score := 2,
    order := 13
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG THÁNG CHI TIẾT" limit 1),
    item_number := 14,
    name := "Tiếp nhận đơn, soạn hàng, đóng hàng, giao hàng xử lý đơn theo quy định",
    evaluator := "ON/ SÀN",
    scope := "ch on to off",
    time_frame := "full (CH online)",
    penalty_level_1 := "50",
    penalty_level_2 := "100",
    penalty_level_3 := "50% TN",
    score := 2,
    order := 14
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG THÁNG CHI TIẾT" limit 1),
    item_number := 15,
    name := "Cập nhật xuất nhập tồn kho bảng tồn Drive",
    evaluator := "ON/ SÀN",
    scope := "ch on to off",
    time_frame := "Hàng ngày \n CHIỀU: 12-17h HT",
    penalty_level_1 := "50",
    penalty_level_2 := "100",
    penalty_level_3 := "50% TN",
    score := 3,
    order := 15
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG THÁNG CHI TIẾT" limit 1),
    item_number := 16,
    name := "Đặt hàng nhập hàng online bổ sung tồn",
    evaluator := "ON/ SÀN",
    scope := "ch on to off",
    time_frame := "T2 Hàng tuần\n CHIỀU: 12-17h",
    penalty_level_1 := "50",
    penalty_level_2 := "100",
    penalty_level_3 := "50% TN",
    score := 3,
    order := 16
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG THÁNG CHI TIẾT" limit 1),
    item_number := 17,
    name := "Làm thẻ kho và sổ theo dõi nhập xuất tồn kho (KHO)",
    evaluator := "KHO",
    scope := "ch on to off",
    time_frame := "Hàng ngày",
    penalty_level_1 := "50",
    penalty_level_2 := "100",
    penalty_level_3 := "50% TN",
    score := 3,
    order := 17
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG THÁNG CHI TIẾT" limit 1),
    item_number := 18,
    name := "Vệ sinh kho: Quầy kệ, CCDC/ trang thiết bị\n Hàng hóa: bảo quản, vệ sinh hàng hóa theo quy định (ADMIN)",
    evaluator := "ADMIN/CAMERA",
    scope := "ch on to off",
    time_frame := "hàng ngày\n 14h-16h",
    penalty_level_1 := "50",
    penalty_level_2 := "100",
    penalty_level_3 := "50% TN",
    score := 2,
    order := 18
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG THÁNG CHI TIẾT" limit 1),
    item_number := 19,
    name := "Đối chiếu và giải trình số lượng tồn kho định kỳ (KTAD)",
    evaluator := "KTAD",
    scope := "ch on to off",
    time_frame := "theo định kỳ\n 10h-12h",
    penalty_level_1 := "50",
    penalty_level_2 := "100",
    penalty_level_3 := "50% TN",
    score := 2,
    order := 19
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG THÁNG CHI TIẾT" limit 1),
    item_number := 20,
    name := "Nhập hàng, công cụ dụng cụ, văn phòng phẩm.",
    evaluator := "ON/ SÀN",
    scope := "ch on to off",
    time_frame := "full (CH online)",
    penalty_level_1 := "50",
    penalty_level_2 := "100",
    penalty_level_3 := "50% TN",
    score := 2,
    order := 20
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG THÁNG CHI TIẾT" limit 1),
    item_number := 21,
    name := "Nhập hàng đổi trả.",
    evaluator := "ON/ SÀN",
    scope := "ch on to off",
    time_frame := "full (CH online)",
    penalty_level_1 := "50",
    penalty_level_2 := "100",
    penalty_level_3 := "50% TN",
    score := 2,
    order := 21
};

insert DetailChecklistItem {
    category := (select DetailCategory filter .name = "CHECK LIST HẰNG THÁNG CHI TIẾT" limit 1),
    item_number := 22,
    name := "Nhập phần mềm HDO",
    evaluator := "ON/ SÀN",
    scope := "ch on to off",
    time_frame := "full (CH online)",
    penalty_level_1 := "50",
    penalty_level_2 := "100",
    penalty_level_3 := "50% TN",
    score := 2,
    order := 22
};


# ============================================================================
# 5. INSERT CHECKLIST RECORDS (Sheet 1 - Approval Workflow Records)
# Now linking to DetailChecklistItem instead of old ChecklistItem
# ============================================================================

# Record 1: Assessment on 2026-01-10
insert ChecklistRecord {
    checklist_item := (
        select DetailChecklistItem
        filter .name = "Đi làm đúng giờ và lấy vân tay theo đúng quy định"
        limit 1
    ),
    staff_id := "staff-001",
    assessment_date := <cal::local_date>'2026-01-10',
    employee_checked := true,
    cht_checked := true,
    asm_checked := true,
    achievement_percentage := 95.0,
    successful_completions := 10,
    score_achieved := 2.85,
    final_classification := 'A'
};

# Record 2: Assessment on 2026-01-11
insert ChecklistRecord {
    checklist_item := (
        select DetailChecklistItem
        filter .name = "Đồng phục/ tác phong đúng quy định"
        limit 1
    ),
    staff_id := "staff-001",
    assessment_date := <cal::local_date>'2026-01-11',
    employee_checked := true,
    cht_checked := true,
    asm_checked := true,
    achievement_percentage := 85.0,
    successful_completions := 8,
    score_achieved := 2.55,
    final_classification := 'B'
};

# Record 3: Assessment on 2026-01-12
insert ChecklistRecord {
    checklist_item := (
        select DetailChecklistItem
        filter .name = "Vệ sinh cửa hàng theo quy định\n - Lau cửa kính, \n - Show window\n - Vật dụng, thiết bị CCDC\n - Quầy kệ\n - Nhà vệ sinh,…"
        limit 1
    ),
    staff_id := "staff-001",
    assessment_date := <cal::local_date>'2026-01-12',
    employee_checked := false,
    cht_checked := false,
    asm_checked := false,
    achievement_percentage := 70.0,
    successful_completions := 5,
    implementation_issues := "Không mặc đồng phục đúng quy định 2 lần",
    score_achieved := 2.1,
    final_classification := 'C'
};

# Record 4: Assessment on 2026-01-13
insert ChecklistRecord {
    checklist_item := (
        select DetailChecklistItem
        filter .name = "Mở các trang thiết bị khi vào ca (máy tính, đèn, máy lạnh)"
        limit 1
    ),
    staff_id := "staff-001",
    assessment_date := <cal::local_date>'2026-01-13',
    employee_checked := false,
    cht_checked := false,
    asm_checked := false,
    achievement_percentage := 50.0,
    successful_completions := 3,
    implementation_issues := "Chưa kiểm soát tốt nội quy",
    score_achieved := 0.5,
    final_classification := 'D'
};

# Record 5: Assessment on 2026-01-14
insert ChecklistRecord {
    checklist_item := (
        select DetailChecklistItem
        filter .name = "Tắt máy lạnh trước khi về 30 phút"
        limit 1
    ),
    staff_id := "staff-001",
    assessment_date := <cal::local_date>'2026-01-14',
    employee_checked := false,
    cht_checked := false,
    asm_checked := false,
    achievement_percentage := 0.0,
    successful_completions := 0,
    implementation_issues := "Không thực hiện",
    score_achieved := 0.0,
    final_classification := 'X'
};

# Record 6: Another staff member assessment
insert ChecklistRecord {
    checklist_item := (
        select DetailChecklistItem
        filter .name = "Đồng phục/ tác phong đúng quy định"
        limit 1
    ),
    staff_id := "staff-002",
    assessment_date := <cal::local_date>'2026-01-10',
    employee_checked := true,
    cht_checked := true,
    asm_checked := true,
    achievement_percentage := 100.0,
    successful_completions := 10,
    score_achieved := 3.0,
    final_classification := 'A'
};


# ============================================================================
# VERIFICATION QUERIES (Optional - can be run separately to verify data)
# ============================================================================
# Uncomment these to verify your data after seeding:

# # Check detail categories with items (used by both sheets)
# select DetailCategory {
#     name,
#     category_type,
#     items: {
#         item_number,
#         name,
#         score,
#         evaluator
#     } order by .item_number
# }
# order by .order;

# # Check all checklist records (Sheet 1 approval workflow)
# select ChecklistRecord {
#     assessment_date,
#     staff_id,
#     checklist_item: { item_number, name, category: { name } },
#     employee_checked,
#     cht_checked,
#     asm_checked,
#     achievement_percentage,
#     successful_completions,
#     score_achieved,
#     final_classification
# }
# order by .assessment_date;
