# Chạy g1-acq miễn phí qua Windows

Dùng mitmproxy **12.2.3** và Node.js để chạy nguồn g1-acq v7.11.0.
Không cần Shadowrocket hay tài khoản proxy trả phí. iPhone và Windows cần
cùng mạng LAN; laptop phải hoạt động trong suốt lượt thử.

## Mở lab trên Windows

```powershell
Set-Location 'D:\KinhDoanh\g1-acq'
Get-NetIPAddress -InterfaceAlias 'Wi-Fi' -AddressFamily IPv4
.\windows\start-lab.ps1 -ListenHost <IPv4-Wi-Fi-cua-laptop> -Port 18080
```

Lần setup ban đầu, IP laptop là **192.168.1.239**, cổng **18080**. Kiểm tra
lại IP khi thay mạng. Chỉ bind địa chỉ LAN cần dùng; mặc định script chỉ
nghe `127.0.0.1` để kiểm thử nội bộ. Đóng tiến trình bằng **Ctrl+C** trong
cửa sổ đã chạy lệnh khi không dùng nữa.

Nếu Windows hỏi quyền truy cập mạng, chỉ cho phép mạng riêng đang dùng.
Nếu phải thêm rule firewall, giới hạn TCP 18080 vào đúng địa chỉ laptop và
mạng nội bộ; không tắt firewall, không mở cổng trên router.

## Cấu hình iPhone

1. Tắt VPN ProxyPin và các VPN khác trên iPhone cho lượt thử Windows.
2. Vào **Cài đặt → Wi-Fi → (i)** cạnh mạng đang kết nối → kéo xuống
   **Định cấu hình proxy / Configure Proxy** → chọn **Thủ công / Manual**.
3. Điền **Server: IP Wi-Fi của laptop**, **Port: 18080**; tắt Authentication
   và nhấn **Lưu / Save**. Không nhập `http://` hoặc đường dẫn vào ô Server.
4. Mở Safari đến **http://mitm.it**. Nếu không tải được, dừng ở đây để kiểm
   tra IP, cùng LAN, tiến trình proxy và firewall. Proxy HTTP phải thông
   trước khi thử HTTPS.
5. Chọn mục dành cho iOS hoặc mở **http://mitm.it/cert/pem**, tải chứng chỉ.
   Chứng chỉ được tạo trên laptop này, khác chứng chỉ ProxyPin đã cài trước.
6. Vào **Cài đặt → Cài đặt chung → VPN & Quản lý thiết bị**, cài hồ sơ
   **mitmproxy** vừa tải. Sau đó **Giới thiệu → Cài đặt tin cậy chứng chỉ**,
   bật tin cậy cho đúng chứng chỉ **mitmproxy**.
7. Trong Safari mở **https://one.google.com/g1-sku-report**. Trang phải có
   **G1 Windows**, **g1-windows-v1.0.0** và **v7.11.0**. Trang được tạo trên
   laptop, không phải website báo cáo công khai của Google.

## Thử Ultra 75p

1. Trong trang báo cáo, áp dụng mẫu **Ultra 20TB / 30TB · 三个月 75p**.
   Thành công trả 303 và lưu cấu hình `custom` với revision mới.
2. Đóng trang chọn gói đang mở rồi vào lại **Google App → Google One**.
   Chọn mục Ultra tài khoản thực tế được cung cấp.
3. Quay lại báo cáo hoặc xuất JSON để kiểm tra thời gian mới,
   `test.status=rewritten`, revision và các đích:
   `g1.20tb.3months_ip_75p.acq`, `g1.ai.ultra.3months_ip_75p.acq`.
4. Ở màn hình App Store, ghi tên gói, giá trong ba tháng đầu, tiền tệ và
   giá gia hạn. Dừng trước xác nhận mua. Mức giá ở trang Google chưa chứng
   minh SKU thay thế được App Store chấp nhận.

Kết quả được ghi riêng: proxy kết nối, script thực thi, SKU khớp và ưu đãi
App Store. Nếu App Store từ chối hoặc tài khoản không có ưu đãi, ghi đúng
lỗi thực tế; không coi riêng tên SKU là xác nhận mua/quyền lợi thành công.

## Dữ liệu, phạm vi và dừng lab

- Chỉ giải mã `one.google.com`; các miền HTTPS khác được chuyển tiếp dạng
  tunnel. Không tắt kiểm tra chứng chỉ máy chủ upstream.
- Ba file schema 1 nằm tại `.git/g1-windows-state/`, độc lập với dữ liệu
  ProxyPin trên iPhone. Worker đọc/ghi tuần tự, thay file rồi đọc lại xác
  minh. Không dùng bộ máy JavaScriptCore của iOS.
- Chứng chỉ và khóa riêng nằm trong `.git/g1-windows-certificates/`.
  Các dữ liệu này không được commit/push. Không lưu toàn bộ traffic ra HAR
  hoặc log theo mặc định.
- Khi dùng xong, vào **Wi-Fi → (i) → Configure Proxy → Off/Tắt → Save**,
  rồi dừng proxy trên laptop. Nếu quên tắt proxy Wi-Fi khi laptop đã tắt,
  iPhone có thể mất truy cập mạng trên Wi-Fi đó.

## Kiểm thử

```powershell
node tools/build-variants.cjs --check
node tools/build-proxypin.cjs --check
node --test tests/*.test.cjs
uvx --from 'mitmproxy==12.2.3' python -B -m unittest discover -s tests -p windows_addon_test.py -v
```

Nguồn: [mitmproxy](https://docs.mitmproxy.org/stable/) và
[cài chứng chỉ](https://docs.mitmproxy.org/stable/concepts/certificates/).

## Tình trạng bản ProxyPin iOS

Bản file adapter ProxyPin iOS 1.4.0 đã vượt kiểm thử offline và từng trả
báo cáo/lưu cấu hình trên thiết bị, nhưng xuất hiện crash JavaScriptCore
trên thiết bị thật khi dùng cùng script phản hồi. Chưa xác nhận nó chạy
ổn định trên iPhone độc lập. Lượt Windows này dùng nguồn gốc qua Node.js
để kiểm chứng chức năng và ưu đãi trước, không kết luận đã hoàn tất bản iOS.
