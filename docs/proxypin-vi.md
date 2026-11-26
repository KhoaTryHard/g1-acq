# g1-acq trên ProxyPin miễn phí

Bản chuyển đổi **g1-proxypin-v1.0.0** chạy bằng ProxyPin iOS **1.4.0 trở
lên**, dùng nguồn g1-acq v7.11.0. Cài ProxyPin từ
[App Store](https://apps.apple.com/vn/app/proxypin-open-source-capture/id6450932949).
Không cần mua Shadowrocket hoặc tạo tài khoản ProxyPin.

## Hai gói cần nhập

- [g1-scripts.json](../proxypin/g1-scripts.json): nhập vào mục **Scripts /
  Script / 脚本**, dùng chức năng nhập file. Gói chứa đầy đủ mã xử lý và
  thu thập SKU, không tải thêm script khi chạy.
- [g1-request-map.json](../proxypin/g1-request-map.json): nhập vào mục
  **Request Mapping / Ánh xạ yêu cầu / 请求映射**. Gói tạo trang quản lý bằng
  phản hồi cục bộ. Đây là một loại cấu hình riêng, không nhập vào Scripts.

Trong GitHub, mở file rồi dùng **Raw / Download raw file** và lưu vào Files
trên iPhone để chọn khi nhập. Địa chỉ tải bàn giao được cố định theo commit
đã xác minh. Mỗi lần nâng cấp, chỉ tắt hai mục G1 cũ và nhập bản mới;
không xóa dữ liệu ứng dụng hay các cấu hình khác. Chỉ bật một bản G1 của
mỗi loại để tránh xử lý lặp.

## Chứng chỉ, HTTPS và chạy nền

1. Mở ProxyPin, vào phần chứng chỉ HTTPS/SSL trong **Cài đặt**. Dùng chức
   năng cài chứng chỉ CA trên máy. Khi iOS yêu cầu tải profile, anh tự
   xác nhận trên thiết bị.
2. Vào **Cài đặt iOS → Cài đặt chung → VPN & Quản lý thiết bị**, cài profile
   chứng chỉ ProxyPin vừa tạo.
3. Vào **Cài đặt chung → Giới thiệu → Cài đặt tin cậy chứng chỉ**, bật tin
   cậy cho đúng chứng chỉ ProxyPin.
4. Trong ProxyPin, bật HTTPS/SSL proxying; dùng danh sách miền cho phép
   để chỉ giải mã `one.google.com`. Giữ các kết nối khác ngoài phạm vi lab.
5. Bật Scripts, Request Mapping và hai mục G1 vừa nhập. Nhấn nút chạy,
   xác nhận thêm cấu hình VPN khi iOS yêu cầu. Bật tùy chọn chạy nền sẵn
   có của ProxyPin để chuyển sang Google App/Safari mà lab vẫn chạy.
6. Không dùng **Force Quit / vuốt tắt ProxyPin** khi đang chạy. Muốn dừng
   lab, dùng nút dừng trong ProxyPin; muốn khôi phục trước lab thì tắt hai
   mục G1 và tắt giải mã cho miền đã thêm.

## Trang quản lý và Ultra 75p

1. Giữ ProxyPin đang chạy; mở Safari tại
   <https://one.google.com/g1-sku-report>.
2. Xác nhận trang có **本机脚本已接管** (script cục bộ đã tiếp quản),
   **ProxyPin**, **g1-proxypin-v1.0.0** và **v7.11.0**. Trang không được hiện
   trang Google thông thường hoặc lỗi 404.
3. Trong **预制映射模板** (mẫu quy tắc), chọn **Ultra 20TB / 30TB · 三个月
   75p** và nhấn **应用模板** (áp dụng). Sau khi lưu, trang trả về bằng 303;
   cấu hình mới là `custom`. `75p` nghĩa là giảm 75%, trả 25% giá tương ứng,
   không có nghĩa là giá 75 đơn vị tiền.
4. Mẫu gồm hai quy tắc chính xác:

| Nguồn | Đích |
|---|---|
| `g1.ios.20tb.m.v2` | `g1.20tb.3months_ip_75p.acq` |
| `g1.ios.30tb.ai.pro.m` | `g1.ai.ultra.3months_ip_75p.acq` |

5. Đóng trang chọn gói đang mở rồi vào lại **Google App → quản lý Google
   One**. Chọn mục Ultra tài khoản thực tế được cung cấp. Chưa có phản hồi
   `/ai?` mới thì cấu hình đã lưu chưa chứng minh có thay SKU.
6. Quay lại báo cáo; kiểm tra `test.status=rewritten`, thời gian mới,
   `test.mappingRevision` bằng revision của cấu hình và từng dòng nguồn/đích.
   Có thể [xuất JSON](https://one.google.com/g1-sku-report?format=json).
7. Mở màn hình thuê bao App Store để ghi lại tên sản phẩm, giá trong ba
   tháng đầu, tiền tệ và giá gia hạn. **Dừng trước nút xác nhận mua**, không
   bấm hai lần nút sườn hay xác thực giao dịch.
8. Rút dây USB, tắt kết nối quản trị MCP nếu đã bật, mở lại gói và báo cáo
   để xác nhận lab hoạt động chỉ với iPhone.

Các nút còn lại: **保存** = lưu, **删除** = xóa quy tắc, **恢复默认** = khôi
phục quy tắc mặc định, **启用** = bật quy tắc, **导出 JSON** = xuất dữ liệu.
Khôi phục mặc định không xóa lịch sử; nếu anh đã có quy tắc riêng, xuất
JSON trước khi thay đổi để giữ bản tham chiếu.

## Dữ liệu và lỗi

Ba file trong thư mục Application Support của ProxyPin giữ nguyên schema 1:
`g1.sku.scan.v1.json`, `g1.pro.annual.test.v1.json`, `g1.sku.mappings.v1.json`.
Mã không sao chép dữ liệu Shadowrocket cũ và không gửi dữ liệu lab về GitHub.
Mỗi lượt đọc lấy dữ liệu từ file, không phụ thuộc vùng nhớ session riêng
của hai loại script. File được đọc/ghi đồng bộ, đọc lại kiểm chứng khi ghi.
File rỗng hoặc lỗi đọc không được coi là một cấu hình mặc định hợp lệ.

- Không thấy trang cục bộ: kiểm tra đúng loại Request Mapping, trạng thái
  bật, HTTPS, chứng chỉ và URL. Không chuyển POST quản lý sang máy chủ Google.
- Có báo cáo nhưng bộ đếm không tăng: mở lại trang gói, xem console script
  và bản ghi mới; phân biệt cache, không có SKU và lỗi lưu dữ liệu.
- `no-match`: phản hồi không có nguồn khớp, hoặc quy tắc đang tắt. Không
  tự thay nguồn bằng SKU phỏng đoán.
- `invalid`/`unavailable` hoặc HTTP 503: xem lỗi file/chứng chỉ, khắc phục
  rồi tải lại; không coi thao tác là đã lưu nếu chưa có phản hồi thành công.
- Script đã thay SKU nhưng App Store từ chối/không hiện ưu đãi: lưu mã lỗi
  và kết quả đã che thông tin cá nhân. Đây là **lab kỹ thuật đã chạy,
  ưu đãi chưa đạt**; không suy ra ưu đãi từ tên SKU.

## Kiểm thử và tạo gói trên Windows

```powershell
Set-Location 'D:\KinhDoanh\g1-acq'
node tools/build-variants.cjs --check
node tools/build-proxypin.cjs --check
node --test tests/mapping-editor.test.cjs tests/sku-tools.test.cjs tests/proxypin.test.cjs
```

Sau khi sửa nguồn gốc hoặc lớp tương thích, chạy hai lệnh sinh gói rồi
kiểm thử lại:

```powershell
node tools/build-variants.cjs
node tools/build-proxypin.cjs
```

Các gói ProxyPin được sinh từ nguồn gốc; không sửa trực tiếp bốn file
trong thư mục `proxypin/`. Các nguồn tham chiếu:
[Script API](https://github.com/wanghongenpin/proxypin/wiki/Script) và
[ProxyPin v1.4.0](https://github.com/wanghongenpin/proxypin/tree/v1.4.0).
