VPN API docs : http://rohserver1.dpdns.org/vps/docs/index.html
QRIS API docs : http://github.com/ahmadzakiyox/gopay-api-gateaway

Website yang ingin dibuat:

Website untuk menjual VPN
Tersedia v2ray (vmess/vless/trojan) dan SSH tunnel

Landing Page -> Login Page -> Dashboard

Dashboard
  - Beli VPN
  - Akun VPN saya
  - Topup saldo
  - Hubungi Admin

Akun VPN saya
  - List VPN account
    - Username VPN
      - Status Akun = (Aktif/Terkunci)
      - Sisa bandwidth VPN (174GB / 200GB terpakai) *misal
      - Informasi tanggal expiration
      - Manage akun (Renew/Tambah Bandwidth/Tambah IP/Hapus/Lock/Unlock)(Cannot unlock if locked by admin)
      - Config siap pakai -> Link to dedicated page
        - XL Edu
          - Label
          - Value to copy
          - Label
          - Value to copy
          - this label and value to copy is the same for below...
        - XL Conference
        - XL Addon XCP (IG/Tiktok/WA/FB)
        - Tsel Ilmupedia / Kuota Belajar
        - Tsel Halo Flexy+
        - Biz Line
        - Biz WA
  - Recovery Akun (rebuy)(can set ip limit/bandwidth)

Topup Saldo
  - Saldo sekarang
  - Isi nominal
  - Riwayat Topup

Beli VPN
  - Pilih server (with filter dropdown indonesia/sg/us)
  - Select protocol (ssh/vmess/vless/trojan)
  - Pilih package
  - Isi username VPN (optional, leave empty for random)
  - Isi uuid custom (optional, leave empty for random)(for v2ray)
  - Checkout
  - Spit out the ssh account info/vless code/vmess code/trojan code

Landing Page
  - Title
  - Business Info in short description
  - Login/Register
  - Kelebihan-kelebihan VPN ditempat kami
  - Login as Admin (very below)

Admin Dashboard
  - Manage server
    - Add server (needs endpoint, apikey, server country, limit jumlah vpn (termasuk ssh+v2ray))
    - List server
      - Pricing VPN (vless/vmess/trojan/ssh filter)(each protocol has their own package)
        - Package 1 (how many gb, how many ip limit, how many days)
        - Package 2
        - Package 3
  - User manager
    - Topup Saldo
    - Kurangi Saldo
    - Set saldo
    - List VPN account user have (with filter ssh/vmess/vless/trojan)
      - Lock/Unlock VPN account
      - Edit limit IP
      - Edit limit bandwidth in GB
      - Delete VPN account
  - Manager Akun VPN (with find feature)(everything is here from all server v2ray/xray and ssh)
    - Lock/Unlock
    - Edit limit IP
    - Edit limit bandwidth in GB
    - Delete VPN account
    - Who this belong to (username)
  - Setup QRIS API (endpoint and key)
  - Setup Telegram Bot API (chatID and api token)
  - Setup Autobackup to Telegram Bot
    - Harian/Mingguan/Bulanan
      - Harian (0-23 hour with minutes)
      - Mingguan (Monday to Sunday)(with hour and mins also)
      - Bulanan (1-30)(with hour and mins also)
  - Setup Telegram Bot Notifications (checklist, check to receive notif)
    - Topup QRIS notif
    - Penyesuaian Saldo oleh Admin (topup/kurangi/set)
    - Pembelian/Renew/Recovery VPN
  - Setup Config Siap Pakai Template
    - XL Edu
    - XL Conference
    - etc..
  - Restore Backup
