import * as SecureStore from 'expo-secure-store';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

export type AppLanguage = 'en' | 'ar';

const LANGUAGE_KEY = 'mobile_language_v1';

const dictionary: Record<AppLanguage, Record<string, string>> = {
  en: {
    'common.back': 'Back',
    'common.cancel': 'Cancel',
    'common.close': 'Close',
    'common.save': 'Save',
    'common.refresh': 'Refresh',
    'common.refreshing': 'Refreshing...',
    'common.logout': 'Logout',
    'common.language': 'Language',
    'common.english': 'English',
    'common.arabic': 'العربية',
    'common.or': 'Or',
    'common.today': 'Today',
    'common.yesterday': 'Yesterday',
    'common.earlier': 'Earlier',
    'common.openLink': 'Open Link',
    'common.openInApp': 'Open in App',
    'common.read': 'Read',
    'common.unread': 'Unread',
    'common.new': 'New',
    'common.seen': 'Seen',
    'common.updating': 'Updating...',
    'common.all': 'All',
    'common.unavailable': 'Unavailable',
    'common.none': 'None',
    'common.viewAll': 'View All',

    'login.title': 'Community Access',
    'login.subtitle':
      'SSS Community connected to the live backend for real booking, services and QR flows.',
    'login.emailLabel': 'Email or Phone',
    'login.passwordLabel': 'Password',
    'login.rememberMe': 'Remember me',
    'login.forgotPassword': 'Forgot password?',
    'login.signIn': 'Sign In',
    'login.signingIn': 'Signing In...',
    'login.authenticating': 'Authenticating...',
    'login.biometricUnavailable': 'Biometric sign-in unavailable',
    'login.signInWithBiometric': 'Sign in with {{label}}',
    'login.accountCreationManaged':
      'Account creation is managed by community administration.',
    'login.contactAdmin':
      'Contact your management team to receive your login credentials.',
    'login.demoCredentials': 'Demo Credentials',
    'login.showDemo': 'Show Demo Credentials',
    'login.hideDemo': 'Hide',
    'login.required': 'Email and password are required.',
    'login.otpRequired': 'OTP is required.',
    'login.otpSentVia': 'A verification code was sent via {{method}}.',
    'login.otpLabel': 'One-Time Password',
    'login.otpPlaceholder': 'Enter OTP',
    'login.verifyOtp': 'Verify OTP',
    'login.verifyingOtp': 'Verifying...',
    'login.useDifferentAccount': 'Use different account',

    'profile.title': 'Profile Information',
    'profile.access': 'Access & Features',
    'profile.support': 'Support',
    'profile.fullName': 'Full Name',
    'profile.email': 'Email',
    'profile.phone': 'Phone',
    'profile.roles': 'Roles',
    'profile.profileTypes': 'Profile Types',
    'profile.lastLogin': 'Last Login',
    'profile.editProfile': 'Edit Profile',
    'profile.saveChanges': 'Save Changes',
    'profile.saving': 'Saving...',
    'profile.noFeaturePermissions':
      'No feature permissions were detected for this account yet.',
    'profile.supportHint':
      'Need help with your account, payments, or access requests? Contact community support from the dashboard support channels.',
    'profile.updated': 'Profile updated',
    'profile.updatedMsg': 'Your profile was updated successfully.',
    'profile.updateFailed': 'Update failed',
    'profile.nothingToSave': 'Nothing to save',
    'profile.enterAtLeastOne': 'Enter at least one field to update.',
    'profile.invalidEmail': 'Invalid email',
    'profile.invalidEmailMsg': 'Enter a valid email address.',
    'profile.twoFactorTitle': 'Two-factor authentication',
    'profile.twoFactorHint': 'Require OTP after email/password login.',
    'profile.twoFactorEnabled': 'Two-factor enabled',
    'profile.twoFactorEnabledMsg': 'A verification OTP will be required on login.',
    'profile.twoFactorDisabled': 'Two-factor disabled',
    'profile.twoFactorDisabledMsg': 'Password-only login is now enabled.',
    'profile.securityUpdateFailed': 'Security update failed',
    'profile.updatingSecurity': 'Updating security preference...',
    'profile.vehiclesTitle': 'My Vehicles',
    'profile.vehiclesAdd': 'Add Vehicle',
    'profile.vehiclesNone': 'No vehicles added yet.',
    'profile.vehiclePrimary': 'Primary',
    'profile.vehicleType': 'Vehicle Type',
    'profile.vehicleModel': 'Vehicle Model',
    'profile.vehiclePlate': 'Plate Number',
    'profile.vehiclePlateHint': 'e.g. ق و 1234',
    'profile.vehicleColor': 'Color',
    'profile.vehicleNotes': 'Notes',
    'profile.vehicleMakePrimary': 'Set as primary vehicle',
    'profile.vehicleSave': 'Save Vehicle',
    'profile.vehicleSaving': 'Saving...',
    'profile.vehicleSaved': 'Vehicle saved',
    'profile.vehicleSaveFailed': 'Failed to save vehicle',
    'profile.vehicleDelete': 'Delete',
    'profile.vehicleDeleted': 'Vehicle deleted',
    'profile.vehicleDeleteFailed': 'Failed to delete vehicle',
    'profile.vehicleEdit': 'Edit',
    'profile.vehicleValidation': 'Missing vehicle fields',

    'drawer.profile': 'Profile',
    'drawer.qrCodes': 'QR Codes',
    'drawer.bookings': 'Bookings',
    'drawer.requests': 'Requests',
    'drawer.services': 'Services',
    'drawer.complaints': 'Complaints',
    'drawer.trackUtility': 'Track Utility',
    'drawer.violations': 'Violations',
    'drawer.payments': 'Payments',
    'drawer.manageHousehold': 'Manage Household',
    'drawer.myProperties': 'MY PROPERTIES',
    'drawer.noUnitSelected': 'No Unit Selected',
    'drawer.logout': 'Logout',

    'tabs.home': 'Home',
    'tabs.qrCodes': 'QR Codes',
    'tabs.profile': 'Profile',

    'home.myUnit': 'My Unit',
    'home.welcomeTo': 'Welcome to',
    'home.communityUpdatesTag': 'COMMUNITY UPDATES',
    'home.communityUpdatesTitle': 'Community Updates',
    'home.quickAccess': 'Quick Access',
    'home.upcomingPayments': 'Upcoming Payments',
    'home.noActiveBanners': 'No active banners right now',
    'home.adminBannersHint':
      'Admin-created banners will appear here automatically when active.',
    'home.imageUnavailable': 'Image unavailable',
    'home.bannerTapHint': 'Tap banner to open',
    'home.noUpdatesYet': 'No updates yet',
    'home.newAnnouncementsHint': 'New community announcements will appear here.',
    'home.noPendingPayments': 'No pending payments',
    'home.duesClear': 'All dues are clear for the selected unit.',
    'home.duePrefix': 'Due',
    'home.payNow': 'Pay Now',
    'home.offerTitle': 'Special Offer',
    'home.offerDismiss': 'Dismiss',
    'home.offerOpen': 'Open Offer',
    'home.smartHomeTitle': 'Smart Home Coming Soon',
    'home.smartHomeSubtitle':
      'You will be able to control supported devices inside your home directly from the app.',
    'home.smartHomeBullet1': '• Lighting and scenes',
    'home.smartHomeBullet2': '• AC and climate controls',
    'home.smartHomeBullet3': '• Device status and quick actions',
    'home.smartHomeHint':
      'Availability depends on your unit setup and supported integrations.',
    'home.smartHomeClose': 'Got it',
    'home.paymentUnavailable': 'Payment unavailable',
    'home.paymentUnavailableHint':
      'This item is not linked to an invoice yet. Open Finance to review details.',
    'home.paymentCompleted': 'Payment completed',
    'home.paymentCompletedHint': 'Your payment was recorded successfully.',
    'home.paymentFailed': 'Payment failed',
    'home.bannerFeedIssue': 'Banner feed issue: {{message}}',
    'home.greeting.morning': 'Good Morning',
    'home.greeting.afternoon': 'Good Afternoon',
    'home.greeting.evening': 'Good Evening',
    'home.greeting.night': 'Good Night',

    'finance.subtitle': 'Invoices, dues and violation fines',
    'finance.badge': 'PAYMENTS & BILLS',
    'finance.heroTitle': 'Invoices & Violations',
    'finance.heroSubtitle': 'Manage your financial obligations for the selected unit.',
    'finance.totalOutstanding': 'Total Outstanding',
    'finance.payablesCount': 'Payables',
    'finance.selectedUnit': 'Selected Unit',
    'finance.summary': 'Summary',
    'finance.pendingInvoices': 'Pending/Overdue Invoices',
    'finance.totalAmount': 'Total amount',
    'finance.totalDue': 'Total due',
    'finance.payablesTitle': 'Payables',
    'finance.noPayables': 'No pending payables for this unit.',
    'finance.violationFine': 'Violation fine',
    'finance.invoice': 'Invoice',
    'finance.payableNow': 'Payable now',
    'finance.invoicesTitle': 'Invoices',
    'finance.noInvoices': 'No invoices found.',
    'finance.paid': 'Paid',
    'finance.unit': 'Unit',
    'finance.noViolations': 'No violations found.',
    'finance.created': 'Created',
    'finance.invoiceDetails': 'Invoice Details',
    'finance.violationDetails': 'Violation Details',
    'finance.details': 'Details',
    'finance.invoiceDetailsHint': 'Review invoice amount, status and payment details.',
    'finance.violationDetailsHint': 'Review violation details and linked invoices.',
    'finance.invoiceNumber': 'Invoice #',
    'finance.violationNumber': 'Violation #',
    'finance.type': 'Type',
    'finance.status': 'Status',
    'finance.amount': 'Amount',
    'finance.dueDate': 'Due Date',
    'finance.paidDate': 'Paid Date',
    'finance.fineAmount': 'Fine Amount',
    'finance.description': 'Description',
    'finance.linkedInvoices': 'Linked Invoices',

    'notifications.title': 'Notifications',
    'notifications.subtitle':
      'Personal updates for your requests, bookings, payments, and account activity.',
    'notifications.noDetails': 'No details available.',
    'notifications.notification': 'Notification',
    'notifications.markAsRead': 'Mark as Read',
    'notifications.noNotifications': 'No personal notifications yet.',
    'notifications.noNotificationsHint':
      'Your notifications will appear here as soon as community operations update your account.',

    'communityUpdates.title': 'Community Updates',
    'communityUpdates.subtitle':
      'Announcements and operational updates shared by the community management.',
    'communityUpdates.noDetails': 'No details provided.',
    'communityUpdates.communityUpdate': 'Community Update',
    'communityUpdates.markAsRead': 'Mark as read',
    'communityUpdates.noUpdates': 'No community updates yet.',
    'communityUpdates.noUpdatesHint':
      'Management announcements and maintenance alerts will appear here.',

    'utility.title': 'Track Utility',
    'utility.subtitle': 'Dummy usage tracker preview for white-label demos.',
    'utility.unitTitle': 'Utility Unit',
    'utility.water': 'Water',
    'utility.gas': 'Gas',
    'utility.electricity': 'Electricity',
    'utility.internet': 'Internet',
    'utility.consumption': 'Consumption',
    'utility.monthlyCycle': 'Monthly cycle',
    'utility.currentUsage': 'Current Usage',
    'utility.remaining': 'Remaining',
    'utility.estimatedBill': 'Estimated Bill',
    'utility.rechargeLeft': 'Recharge Left',
    'utility.usageTrend': 'Usage Trend',
    'utility.demoHint': 'Demo data only. Live meters integration can be connected later.',

    'fire.title': 'Fire Evacuation Alert',
    'fire.message':
      'Emergency alarm triggered. Please evacuate immediately and confirm once you are safe.',
    'fire.pendingResidents': '{{count}} residents still pending confirmation',
    'fire.iAmSafe': 'I Have Evacuated Safely',
    'fire.confirming': 'Confirming...',
    'fire.confirmedSafe': 'Your evacuation confirmation has been received.',
    'fire.confirmationSuccess': 'Safety confirmation sent',
    'fire.confirmationFailed': 'Failed to confirm safety status',
  },
  ar: {
    'common.back': 'رجوع',
    'common.cancel': 'إلغاء',
    'common.close': 'إغلاق',
    'common.save': 'حفظ',
    'common.refresh': 'تحديث',
    'common.refreshing': 'جاري التحديث...',
    'common.logout': 'تسجيل الخروج',
    'common.language': 'اللغة',
    'common.english': 'English',
    'common.arabic': 'العربية',
    'common.or': 'أو',
    'common.today': 'اليوم',
    'common.yesterday': 'أمس',
    'common.earlier': 'الأقدم',
    'common.openLink': 'فتح الرابط',
    'common.openInApp': 'فتح داخل التطبيق',
    'common.read': 'مقروء',
    'common.unread': 'غير مقروء',
    'common.new': 'جديد',
    'common.seen': 'تمت المشاهدة',
    'common.updating': 'جاري التحديث...',
    'common.all': 'الكل',
    'common.unavailable': 'غير متاح',
    'common.none': 'لا يوجد',
    'common.viewAll': 'عرض الكل',

    'login.title': 'دخول المجتمع',
    'login.subtitle':
      'تطبيق SSS Community متصل بالباك إند الفعلي للحجوزات والخدمات وQR.',
    'login.emailLabel': 'البريد الإلكتروني أو الهاتف',
    'login.passwordLabel': 'كلمة المرور',
    'login.rememberMe': 'تذكرني',
    'login.forgotPassword': 'نسيت كلمة المرور؟',
    'login.signIn': 'تسجيل الدخول',
    'login.signingIn': 'جاري تسجيل الدخول...',
    'login.authenticating': 'جاري التحقق...',
    'login.biometricUnavailable': 'تسجيل الدخول البيومتري غير متاح',
    'login.signInWithBiometric': 'الدخول باستخدام {{label}}',
    'login.accountCreationManaged':
      'إنشاء الحسابات يتم عن طريق إدارة الكمبوند فقط.',
    'login.contactAdmin':
      'تواصل مع الإدارة لاستلام بيانات الدخول الخاصة بك.',
    'login.demoCredentials': 'حسابات تجريبية',
    'login.showDemo': 'عرض الحسابات التجريبية',
    'login.hideDemo': 'إخفاء',
    'login.required': 'البريد الإلكتروني وكلمة المرور مطلوبان.',
    'login.otpRequired': 'رمز التحقق مطلوب.',
    'login.otpSentVia': 'تم إرسال رمز تحقق عبر {{method}}.',
    'login.otpLabel': 'رمز التحقق المؤقت',
    'login.otpPlaceholder': 'أدخل رمز التحقق',
    'login.verifyOtp': 'تأكيد الرمز',
    'login.verifyingOtp': 'جاري التحقق...',
    'login.useDifferentAccount': 'استخدام حساب آخر',

    'profile.title': 'بيانات الحساب',
    'profile.access': 'الصلاحيات والمزايا',
    'profile.support': 'الدعم',
    'profile.fullName': 'الاسم الكامل',
    'profile.email': 'البريد الإلكتروني',
    'profile.phone': 'رقم الهاتف',
    'profile.roles': 'الأدوار',
    'profile.profileTypes': 'أنواع الحساب',
    'profile.lastLogin': 'آخر تسجيل دخول',
    'profile.editProfile': 'تعديل الحساب',
    'profile.saveChanges': 'حفظ التعديلات',
    'profile.saving': 'جاري الحفظ...',
    'profile.noFeaturePermissions': 'لا توجد صلاحيات مفعلة لهذا الحساب حاليًا.',
    'profile.supportHint':
      'إذا احتجت مساعدة بخصوص الحساب أو المدفوعات أو الطلبات، تواصل مع دعم الإدارة.',
    'profile.updated': 'تم تحديث الحساب',
    'profile.updatedMsg': 'تم حفظ التعديلات بنجاح.',
    'profile.updateFailed': 'فشل التحديث',
    'profile.nothingToSave': 'لا توجد تغييرات',
    'profile.enterAtLeastOne': 'أدخل قيمة واحدة على الأقل للتحديث.',
    'profile.invalidEmail': 'بريد إلكتروني غير صالح',
    'profile.invalidEmailMsg': 'يرجى إدخال بريد إلكتروني صحيح.',
    'profile.twoFactorTitle': 'التحقق بخطوتين',
    'profile.twoFactorHint': 'يتطلب رمز OTP بعد إدخال البريد وكلمة المرور.',
    'profile.twoFactorEnabled': 'تم تفعيل التحقق بخطوتين',
    'profile.twoFactorEnabledMsg': 'سيتم طلب رمز OTP عند تسجيل الدخول.',
    'profile.twoFactorDisabled': 'تم إيقاف التحقق بخطوتين',
    'profile.twoFactorDisabledMsg': 'يمكن تسجيل الدخول بكلمة المرور فقط الآن.',
    'profile.securityUpdateFailed': 'فشل تحديث إعدادات الأمان',
    'profile.updatingSecurity': 'جاري تحديث إعدادات الأمان...',
    'profile.vehiclesTitle': 'سياراتي',
    'profile.vehiclesAdd': 'إضافة سيارة',
    'profile.vehiclesNone': 'لا توجد سيارات مضافة بعد.',
    'profile.vehiclePrimary': 'أساسية',
    'profile.vehicleType': 'نوع السيارة',
    'profile.vehicleModel': 'موديل السيارة',
    'profile.vehiclePlate': 'رقم اللوحة',
    'profile.vehiclePlateHint': 'مثال: ق و 1234',
    'profile.vehicleColor': 'اللون',
    'profile.vehicleNotes': 'ملاحظات',
    'profile.vehicleMakePrimary': 'تعيين كسيارة أساسية',
    'profile.vehicleSave': 'حفظ السيارة',
    'profile.vehicleSaving': 'جاري الحفظ...',
    'profile.vehicleSaved': 'تم حفظ السيارة',
    'profile.vehicleSaveFailed': 'فشل حفظ السيارة',
    'profile.vehicleDelete': 'حذف',
    'profile.vehicleDeleted': 'تم حذف السيارة',
    'profile.vehicleDeleteFailed': 'فشل حذف السيارة',
    'profile.vehicleEdit': 'تعديل',
    'profile.vehicleValidation': 'بيانات السيارة غير مكتملة',

    'drawer.profile': 'الملف الشخصي',
    'drawer.qrCodes': 'أكواد QR',
    'drawer.bookings': 'الحجوزات',
    'drawer.requests': 'الطلبات',
    'drawer.services': 'الخدمات',
    'drawer.complaints': 'الشكاوى',
    'drawer.trackUtility': 'متابعة المرافق',
    'drawer.violations': 'المخالفات',
    'drawer.payments': 'المدفوعات',
    'drawer.manageHousehold': 'إدارة الأسرة',
    'drawer.myProperties': 'وحداتي',
    'drawer.noUnitSelected': 'لا توجد وحدة محددة',
    'drawer.logout': 'تسجيل الخروج',

    'tabs.home': 'الرئيسية',
    'tabs.qrCodes': 'أكواد QR',
    'tabs.profile': 'الحساب',

    'home.myUnit': 'وحدتي',
    'home.welcomeTo': 'مرحبًا بك في',
    'home.communityUpdatesTag': 'تحديثات المجتمع',
    'home.communityUpdatesTitle': 'تحديثات المجتمع',
    'home.quickAccess': 'الوصول السريع',
    'home.upcomingPayments': 'المدفوعات القادمة',
    'home.noActiveBanners': 'لا توجد بانرات نشطة حاليًا',
    'home.adminBannersHint': 'سيتم عرض البانرات المضافة من الإدارة هنا تلقائيًا عند تفعيلها.',
    'home.imageUnavailable': 'الصورة غير متاحة',
    'home.bannerTapHint': 'اضغط على البانر للفتح',
    'home.noUpdatesYet': 'لا توجد تحديثات بعد',
    'home.newAnnouncementsHint': 'ستظهر إعلانات المجتمع الجديدة هنا.',
    'home.noPendingPayments': 'لا توجد مدفوعات مستحقة',
    'home.duesClear': 'كل المستحقات مسددة للوحدة المحددة.',
    'home.duePrefix': 'الاستحقاق',
    'home.payNow': 'ادفع الآن',
    'home.offerTitle': 'عرض خاص',
    'home.offerDismiss': 'إغلاق',
    'home.offerOpen': 'فتح العرض',
    'home.smartHomeTitle': 'المنزل الذكي قريبًا',
    'home.smartHomeSubtitle':
      'ستتمكن من التحكم في الأجهزة المدعومة داخل منزلك مباشرة من التطبيق.',
    'home.smartHomeBullet1': '• الإضاءة والمشاهد',
    'home.smartHomeBullet2': '• التكييف والتحكم بالمناخ',
    'home.smartHomeBullet3': '• حالة الأجهزة والإجراءات السريعة',
    'home.smartHomeHint':
      'توفّر الخاصية يعتمد على تجهيز وحدتك والتكاملات المدعومة.',
    'home.smartHomeClose': 'حسنًا',
    'home.paymentUnavailable': 'الدفع غير متاح',
    'home.paymentUnavailableHint':
      'هذا العنصر غير مرتبط بفاتورة حتى الآن. افتح صفحة المدفوعات للمراجعة.',
    'home.paymentCompleted': 'تمت عملية الدفع',
    'home.paymentCompletedHint': 'تم تسجيل الدفع بنجاح.',
    'home.paymentFailed': 'فشل الدفع',
    'home.bannerFeedIssue': 'مشكلة في تحميل البانرات: {{message}}',
    'home.greeting.morning': 'صباح الخير',
    'home.greeting.afternoon': 'مساء الخير',
    'home.greeting.evening': 'مساء الخير',
    'home.greeting.night': 'ليلة سعيدة',

    'finance.subtitle': 'الفواتير والمستحقات وغرامات المخالفات',
    'finance.badge': 'المدفوعات والفواتير',
    'finance.heroTitle': 'الفواتير والمخالفات',
    'finance.heroSubtitle': 'إدارة الالتزامات المالية للوحدة المحددة.',
    'finance.totalOutstanding': 'إجمالي المستحق',
    'finance.payablesCount': 'المستحقات',
    'finance.selectedUnit': 'الوحدة المحددة',
    'finance.summary': 'الملخص',
    'finance.pendingInvoices': 'فواتير معلقة/متأخرة',
    'finance.totalAmount': 'إجمالي المبلغ',
    'finance.totalDue': 'إجمالي المستحق',
    'finance.payablesTitle': 'المستحقات',
    'finance.noPayables': 'لا توجد مستحقات حالية لهذه الوحدة.',
    'finance.violationFine': 'غرامة مخالفة',
    'finance.invoice': 'فاتورة',
    'finance.payableNow': 'قابلة للدفع الآن',
    'finance.invoicesTitle': 'الفواتير',
    'finance.noInvoices': 'لا توجد فواتير.',
    'finance.paid': 'تم السداد',
    'finance.unit': 'الوحدة',
    'finance.noViolations': 'لا توجد مخالفات.',
    'finance.created': 'تاريخ الإنشاء',
    'finance.invoiceDetails': 'تفاصيل الفاتورة',
    'finance.violationDetails': 'تفاصيل المخالفة',
    'finance.details': 'التفاصيل',
    'finance.invoiceDetailsHint': 'راجع مبلغ الفاتورة والحالة وبيانات السداد.',
    'finance.violationDetailsHint': 'راجع تفاصيل المخالفة والفواتير المرتبطة.',
    'finance.invoiceNumber': 'رقم الفاتورة',
    'finance.violationNumber': 'رقم المخالفة',
    'finance.type': 'النوع',
    'finance.status': 'الحالة',
    'finance.amount': 'المبلغ',
    'finance.dueDate': 'تاريخ الاستحقاق',
    'finance.paidDate': 'تاريخ السداد',
    'finance.fineAmount': 'قيمة الغرامة',
    'finance.description': 'الوصف',
    'finance.linkedInvoices': 'الفواتير المرتبطة',

    'notifications.title': 'الإشعارات',
    'notifications.subtitle':
      'تحديثات شخصية تخص الطلبات والحجوزات والمدفوعات ونشاط الحساب.',
    'notifications.noDetails': 'لا توجد تفاصيل متاحة.',
    'notifications.notification': 'إشعار',
    'notifications.markAsRead': 'وضع كمقروء',
    'notifications.noNotifications': 'لا توجد إشعارات شخصية حتى الآن.',
    'notifications.noNotificationsHint':
      'ستظهر الإشعارات هنا فور وصول تحديثات جديدة من الإدارة.',

    'communityUpdates.title': 'تحديثات المجتمع',
    'communityUpdates.subtitle':
      'إعلانات وتحديثات تشغيلية صادرة من إدارة المجتمع.',
    'communityUpdates.noDetails': 'لا توجد تفاصيل.',
    'communityUpdates.communityUpdate': 'تحديث مجتمع',
    'communityUpdates.markAsRead': 'وضع كمقروء',
    'communityUpdates.noUpdates': 'لا توجد تحديثات مجتمع حتى الآن.',
    'communityUpdates.noUpdatesHint':
      'ستظهر هنا إعلانات الإدارة وتنبيهات الصيانة.',

    'utility.title': 'متابعة المرافق',
    'utility.subtitle': 'عرض تجريبي احترافي لحين الربط الفعلي مع العدادات.',
    'utility.unitTitle': 'وحدة المرافق',
    'utility.water': 'المياه',
    'utility.gas': 'الغاز',
    'utility.electricity': 'الكهرباء',
    'utility.internet': 'الإنترنت',
    'utility.consumption': 'الاستهلاك',
    'utility.monthlyCycle': 'الدورة الشهرية',
    'utility.currentUsage': 'الاستهلاك الحالي',
    'utility.remaining': 'المتبقي',
    'utility.estimatedBill': 'الفاتورة المتوقعة',
    'utility.rechargeLeft': 'الرصيد المتبقي',
    'utility.usageTrend': 'اتجاه الاستهلاك',
    'utility.demoHint': 'بيانات تجريبية فقط. يمكن ربط العدادات الحقيقية لاحقًا.',

    'fire.title': 'تنبيه إخلاء حريق',
    'fire.message':
      'تم إطلاق إنذار طوارئ. يرجى الإخلاء فورًا ثم تأكيد الوصول إلى مكان آمن.',
    'fire.pendingResidents': '{{count}} ساكن لم يؤكد الإخلاء بعد',
    'fire.iAmSafe': 'تم الإخلاء وأنا في مكان آمن',
    'fire.confirming': 'جاري التأكيد...',
    'fire.confirmedSafe': 'تم استلام تأكيد الإخلاء بنجاح.',
    'fire.confirmationSuccess': 'تم إرسال تأكيد السلامة',
    'fire.confirmationFailed': 'تعذر إرسال تأكيد السلامة',
  },
};

function detectSystemLanguage(): AppLanguage {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale || 'en';
    return locale.toLowerCase().startsWith('ar') ? 'ar' : 'en';
  } catch {
    return 'en';
  }
}

type I18nContextValue = {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('en');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await SecureStore.getItemAsync(LANGUAGE_KEY);
        const next =
          saved === 'ar' || saved === 'en' ? (saved as AppLanguage) : detectSystemLanguage();
        if (!cancelled) setLanguageState(next);
      } catch {
        if (!cancelled) setLanguageState(detectSystemLanguage());
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setLanguage = useCallback(async (next: AppLanguage) => {
    setLanguageState(next);
    try {
      await SecureStore.setItemAsync(LANGUAGE_KEY, next);
    } catch {
      // best effort only
    }
  }, []);

  const t = useCallback(
    (key: string, params?: Record<string, string | number>) => {
      const base =
        dictionary[language][key] ??
        dictionary.en[key] ??
        key;
      if (!params) return base;
      return Object.entries(params).reduce((acc, [paramKey, value]) => {
        return acc.replaceAll(`{{${paramKey}}}`, String(value));
      }, base);
    },
    [language],
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      setLanguage,
      t,
    }),
    [language, setLanguage, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('useI18n must be used inside I18nProvider');
  }
  return ctx;
}
