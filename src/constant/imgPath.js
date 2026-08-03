/**
 * imgPath.js
 * Central registry of all image assets used across the app.
 * Always import images from here — never require() directly in components.
 */
export default {
  // ── Vehicle top-view markers (used on map) ───────────────────────────────
  ic_bike:       require('../assets/bike.png'),
  ic_scooter:    require('../assets/scooter.png'),
  ic_topscooter: require('../assets/topscooter.png'),
  ic_auto:       require('../assets/auto.png'),
  ic_truck:      require('../assets/truck.png'),
  ic_motor:      require('../assets/motor.png'),
  ic_motorcycle: require('../assets/motorcycle.png'),
  ic_riksha:     require('../assets/riksha.png'),
  ic_minitruck:  require('../assets/mini-truck.png'),

  // ── Map pins ────────────────────────────────────────────────────────────
  ic_pick:       require('../assets/pin.png'),
  ic_drop:       require('../assets/droppin.png'),
  ic_pin_one:    require('../assets/pin_one.png'),
  ic_drop_one:   require('../assets/droppin_one.png'),

  // ── Branding / UI ───────────────────────────────────────────────────────
  ic_logo:       require('../assets/logo.png'),
  ic_splash:     require('../assets/splash_logo.png'),
  ic_online:     require('../assets/online.png'),
  ic_profile:    require('../assets/profile.png'),
  ic_trophy:     require('../assets/trophy.png'),
  ic_wallet:     require('../assets/wallet.png'),
  ic_withdraw:   require('../assets/withdraw.png'),
  ic_siren:      require('../assets/siren.png'),
  ic_no_wifi:    require('../assets/no-wifi.png'),
  ic_arrow:      require('../assets/arrow.png'),

  // ── Headers ─────────────────────────────────────────────────────────────
  ic_header_1:   require('../assets/header_1.png'),
  ic_header_2:   require('../assets/header_2.png'),

  // ── Notification ────────────────────────────────────────────────────────
  ic_notif_logo: require('../assets/godelivo_notification_logo.png'),
};