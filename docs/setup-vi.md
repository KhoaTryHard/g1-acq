# Cài đặt g1-acq trên Windows và iPhone/iPad

Hướng dẫn này dùng bản **v7.11.0**, commit gốc
`dad2cd0ac1de7433312f399628ffa52690afe10a`. Một số đoạn README và mô tả
module vẫn ghi v7.10.0; script thực tế của bản này dùng báo cáo `v7.11.0`
và bộ xử lý `g1-acq-v7.11-mappings`.

## 1. Repo trên Windows

- Thư mục: `D:\KinhDoanh\g1-acq`.
- Fork của anh (`origin`): <https://github.com/KhoaTryHard/g1-acq>.
- Repo tác giả (`upstream`): <https://github.com/crhywun/g1-acq>.
- Yêu cầu: Git và Node.js 18 trở lên; máy hiện dùng Node.js 24.
- Không có web server hay package cần cài bằng npm. Không cần Docker.

Mở PowerShell và chạy:

```powershell
Set-Location 'D:\KinhDoanh\g1-acq'
node tools/build-variants.cjs --check
node --test tests/mapping-editor.test.cjs tests/sku-tools.test.cjs
```

Lệnh đầu kiểm tra các đoạn sinh tự động và bản sao script. Lệnh sau chạy
toàn bộ kiểm thử offline. Script dùng API của Shadowrocket khi chạy trên
điện thoại; không khởi động ứng dụng bằng `node g1-acq.js`.

`.gitattributes` giữ file văn bản ở kiểu xuống dòng LF. Việc Git tự đổi
thành CRLF trên Windows có thể khiến kiểm tra đồng bộ báo file `stale`
dù logic script không thay đổi. Không chạy sinh lại script chỉ để che lỗi
kiểu xuống dòng. Khi thực sự sửa engine hoặc nguồn, chạy
`node tools/build-variants.cjs` rồi kiểm thử lại.

## 2. Chuẩn bị iPhone/iPad

1. Cài **Shadowrocket** từ App Store (ứng dụng có thể yêu cầu mua), cùng
   **Google App** có biểu tượng chữ G nhiều màu. Việc mua ứng dụng do anh
   xác nhận trực tiếp trên thiết bị.
2. Trong Shadowrocket, mở phần quản lý **Modules / 模块** của cấu hình
   đang dùng và thêm URL module ở mục 3.
3. Nếu từng cài G1 ACQ, G1 ACQ Ultra, G1 SKU Scan hoặc G1 Pro Annual Test,
   tắt các module cũ; chỉ bật một module **G1 ACQ SKU 管理**.

## 3. Module cố định v7.11.0

Sao chép toàn bộ URL này vào chức năng thêm module bằng URL:

```text
https://cdn.jsdelivr.net/gh/crhywun/g1-acq@v7.11.0/g1-acq-ultra-discount.sgmodule
```

[Mở địa chỉ module](https://cdn.jsdelivr.net/gh/crhywun/g1-acq@v7.11.0/g1-acq-ultra-discount.sgmodule).
Module tự khai báo hai script cần tải; không cần thêm từng script.
Fork giữ nguyên các URL cố định của tác giả.

## 4. Bật giải mã HTTPS

1. Trong Shadowrocket, vào **Config / 配置**, nhấn **(i)** bên phải cấu hình
   đang sử dụng, rồi mở **HTTPS Decryption / HTTPS 解密**.
2. Bật HTTPS Decryption. Tạo và cài chứng chỉ Shadowrocket theo hướng dẫn
   của ứng dụng; nếu đã có chứng chỉ hợp lệ và được tin cậy thì dùng lại.
3. Vào iOS **Settings → General → VPN & Device Management** để cài profile
   chứng chỉ vừa tạo. Tên tiếng Việt thường là **Cài đặt → Cài đặt chung →
   VPN & Quản lý thiết bị**.
4. Vào **Settings → General → About → Certificate Trust Settings** để bật
   tin cậy chứng chỉ Shadowrocket vừa cài.
5. Kiểm tra danh sách hostname trong HTTPS Decryption có `one.google.com`.
   Đây là danh sách giải mã HTTPS, không phải DNS Hosts.
6. Bật module và kết nối lại Shadowrocket; chấp nhận yêu cầu thêm cấu hình
   VPN của iOS nếu đây là lần đầu.

Module giải mã lưu lượng tới `one.google.com`. Module cũng chặn UDP cổng
443 trên toàn bộ kết nối để các ứng dụng có hỗ trợ quay về TCP; điều này
có thể ảnh hưởng tốc độ hoặc kết nối HTTP/3 của ứng dụng khác.

## 5. Kiểm tra trên điện thoại

1. Giữ Shadowrocket đang kết nối. Trong Safari, mở:
   <https://one.google.com/g1-sku-report>.
2. Trang phải có **本机脚本已接管** (script trên máy đã tiếp quản) và
   **v7.11.0**. Trang này do Shadowrocket tạo trên điện thoại, không phải
   web server trên Windows.
3. Giữ quy tắc mặc định cho lần kiểm tra đầu. Mở **Google App → quản lý
   Google One**, xem các gói tài khoản thực tế được cung cấp, chờ tải xong.
4. Quay lại Safari, tải lại báo cáo. So sánh thời gian và bộ đếm mới;
   `scan.version` phải là `g1-acq-v7.11-mappings` khi đã lưu một lượt quét
   mới. Nếu chỉ xem lại SKU cũ, số lần xuất hiện tăng mà danh sách không
   nhất thiết thêm ID.
5. Nếu có phản hồi `/ai?`, xem `test.version`, `test.updatedAt`, trạng thái
   và số lần khớp. `no-match` nghĩa là không có quy tắc khớp trong phản hồi
   đó, không tự động đồng nghĩa cài đặt lỗi.
6. Có thể [xuất JSON](https://one.google.com/g1-sku-report?format=json)
   để kiểm tra phiên bản, bộ đếm và bản ghi. Không cần hoàn tất mua thuê bao.

Nếu trang báo cáo hiện 404 hoặc trang Google thông thường, kiểm tra đúng
URL, kết nối Shadowrocket, module duy nhất đang bật, chứng chỉ được tin
cậy và hostname giải mã. Sau đó kết nối lại, đóng/mở lại trang gói cước.
Nếu bộ đếm không tăng, xem log `saved=no` hoặc `SKU collection unavailable`
trước khi kết luận không có lưu lượng. Không xóa lịch sử để thử sửa lỗi.

Kết quả offline chỉ xác minh logic script và báo cáo. Việc module đã chạy
trên thiết bị cần được xác nhận bằng bước kiểm tra ở trên; giá, chu kỳ và
quyền lợi thuê bao phụ thuộc thông tin App Store và tài khoản thực tế.

## 6. Lưu các phiên bản thay đổi

Trước mỗi lần sửa code, tạo nhánh mới theo mẫu
`version/YYYYMMDD-HHMMSS-short-description`, lấy thời gian Asia/Saigon.
Sau khi kiểm thử, commit và push nhánh lên `origin`; kiểm tra SHA bằng
`git ls-remote origin refs/heads/<ten-nhanh>` trước khi xác nhận đã lưu trên
GitHub. Giữ các nhánh cũ. Chỉ fetch từ `upstream` khi cần xem cập nhật;
không tự đổi nền v7.11.0 trong đợt setup này.
