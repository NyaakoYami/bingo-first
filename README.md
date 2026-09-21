# Bingo First

Bingo theo số với bảng xếp hạng người hoàn thành theo đúng thứ tự bấm **BINGO**. Ứng dụng là Vite tĩnh, dùng Supabase Realtime để 200 người trong cùng phòng nhìn thấy số gọi và thứ tự thắng ngay lập tức.

## Chạy thử

```bash
npm install
npm run dev
```

Không có biến môi trường, app chạy ở **chế độ demo trên một trình duyệt**. Để mọi người cùng tham gia một phòng, tạo một dự án Supabase miễn phí:

1. Mở SQL Editor, chạy [`supabase/schema.sql`](supabase/schema.sql).
2. Sao chép `.env.example` thành `.env`, điền URL và anon key của dự án.
3. Trong `src/main.js`, đổi `DEMO-2026` thành mã phòng bạn muốn (hoặc truyền `?room=TEN-PHONG` vào URL).

## Đưa lên GitHub & Vercel

```bash
git init
git add .
git commit -m "Create Bingo First"
# Tạo một repository trống trên GitHub, rồi thay URL dưới đây
git remote add origin https://github.com/TAI-KHOAN/bingo-first.git
git push -u origin main
```

Trên Vercel: **Add New → Project → Import** repository GitHub, thêm hai biến môi trường từ `.env`, sau đó Deploy. Vercel sẽ tự deploy lại mỗi lần bạn push. Không đưa Service Role key lên Vercel.

## Lưu ý vận hành

- Chỉ nên cấp quyền “người dẫn” cho người điều hành: trước khi mở ván, đặt `isHost = true` trong Local Storage của máy người dẫn (bảng điều khiển sẽ tự hiện). Bản demo mặc định hiển thị cho mọi người để dễ thử.
- RLS ở schema được mở tối giản cho ván công khai. Với sự kiện thật, nên thêm mã PIN/Edge Function cho thao tác gọi số và reset để người chơi không thể điều khiển ván.
