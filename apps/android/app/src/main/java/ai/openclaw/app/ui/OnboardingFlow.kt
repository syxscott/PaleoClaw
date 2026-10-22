package ai.openclaw.app.ui

import android.Manifest
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.WindowInsetsSides
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.only
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawing
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.ExpandLess
import androidx.compose.material.icons.filled.ExpandMore
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.import androidx.compose.ui.graphics.
import androidx.compose.ui.res.stringResourceimport androidx.compose.ui.graphics.
import androidx.compose.ui.res.stringResourceBrush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import androidx.core.net.toUri
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import ai.openclaw.app.LocationMode
import ai.openclaw.app.MainViewModel
import ai.openclaw.app.R
import ai.openclaw.app.node.DeviceNotificationListenerService
import com.journeyapps.barcodescanner.ScanContract
import com.journeyapps.barcodescanner.ScanOptions

private enum class OnboardingStep(val index: Int, val label: String) {
  Welcome(1, "Welcome"),
  Gateway(2, "Gateway"),
  Permissions(3, "Permissions"),
  FinalCheck(4, "Connect"),
}

private enum class GatewayInputMode {
  SetupCode,
  Manual,
}

private enum class PermissionToggle {
  Discovery,
  Location,
  Notifications,
  Microphone,
  Camera,
  Photos,
  Contacts,
  Calendar,
  Motion,
  Sms,
}

private enum class SpecialAccessToggle {
  NotificationListener,
  AppUpdates,
}

private val onboardingBackgroundGradient =
  listOf(
    Color(0xFFFFFFFF),
    Color(0xFFF7F8FA),
    Color(0xFFEFF1F5),
  )
private val onboardingSurface = Color(0xFFF6F7FA)
private val onboardingBorder = Color(0xFFE5E7EC)
private val onboardingBorderStrong = Color(0xFFD6DAE2)
private val onboardingText = Color(0xFF17181C)
private val onboardingTextSecondary = Color(0xFF4D5563)
private val onboardingTextTertiary = Color(0xFF8A92A2)
private val onboardingAccent = Color(0xFF1D5DD8)
private val onboardingAccentSoft = Color(0xFFECF3FF)
private val onboardingSuccess = Color(0xFF2F8C5A)
private val onboardingWarning = Color(0xFFC8841A)
private val onboardingCommandBg = Color(0xFF15171B)
private val onboardingCommandBorder = Color(0xFF2B2E35)
private val onboardingCommandAccent = Color(0xFF3FC97A)
private val onboardingCommandText = Color(0xFFE8EAEE)

private val onboardingFontFamily =
  FontFamily(
    Font(resId = R.font.manrope_400_regular, weight = FontWeight.Normal),
    Font(resId = R.font.manrope_500_medium, weight = FontWeight.Medium),
    Font(resId = R.font.manrope_600_semibold, weight = FontWeight.SemiBold),
    Font(resId = R.font.manrope_700_bold, weight = FontWeight.Bold),
  )

private val onboardingDisplayStyle =
  TextStyle(
    fontFamily = onboardingFontFamily,
    fontWeight = FontWeight.Bold,
    fontSize = 34.sp,
    lineHeight = 40.sp,
    letterSpacing = (-0.8).sp,
  )

private val onboardingTitle1Style =
  TextStyle(
    fontFamily = onboardingFontFamily,
    fontWeight = FontWeight.SemiBold,
    fontSize = 24.sp,
    lineHeight = 30.sp,
    letterSpacing = (-0.5).sp,
  )

private val onboardingHeadlineStyle =
  TextStyle(
    fontFamily = onboardingFontFamily,
    fontWeight = FontWeight.SemiBold,
    fontSize = 16.sp,
    lineHeight = 22.sp,
    letterSpacing = (-0.1).sp,
  )

private val onboardingBodyStyle =
  TextStyle(
    fontFamily = onboardingFontFamily,
    fontWeight = FontWeight.Medium,
    fontSize = 15.sp,
    lineHeight = 22.sp,
  )

private val onboardingCalloutStyle =
  TextStyle(
    fontFamily = onboardingFontFamily,
    fontWeight = FontWeight.Medium,
    fontSize = 14.sp,
    lineHeight = 20.sp,
  )

private val onboardingCaption1Style =
  TextStyle(
    fontFamily = onboardingFontFamily,
    fontWeight = FontWeight.Medium,
    fontSize = 12.sp,
    lineHeight = 16.sp,
    letterSpacing = 0.2.sp,
  )

private val onboardingCaption2Style =
  TextStyle(
    fontFamily = onboardingFontFamily,
    fontWeight = FontWeight.Medium,
    fontSize = 11.sp,
    lineHeight = 14.sp,
    letterSpacing = 0.4.sp,
  )

@Composable
fun OnboardingFlow(viewModel: MainViewModel, modifier: Modifier = Modifier) {
  val context = androidx.compose.ui.platform.LocalContext.current
  val statusText by viewModel.statusText.collectAsState()
  val isConnected by viewModel.isConnected.collectAsState()
  val serverName by viewModel.serverName.collectAsState()
  val remoteAddress by viewModel.remoteAddress.collectAsState()
  val persistedGatewayToken by viewModel.gatewayToken.collectAsState()
  val pendingTrust by viewModel.pendingGatewayTrust.collectAsState()

  var step by rememberSaveable { mutableStateOf(OnboardingStep.Welcome) }
  var setupCode by rememberSaveable { mutableStateOf("") }
  var gatewayUrl by rememberSaveable { mutableStateOf("") }
  var gatewayPassword by rememberSaveable { mutableStateOf("") }
  var gatewayInputMode by rememberSaveable { mutableStateOf(GatewayInputMode.SetupCode) }
  var gatewayAdvancedOpen by rememberSaveable { mutableStateOf(false) }
  var manualHost by rememberSaveable { mutableStateOf("10.0.2.2") }
  var manualPort by rememberSaveable { mutableStateOf("18789") }
  var manualTls by rememberSaveable { mutableStateOf(false) }
  var gatewayError by rememberSaveable { mutableStateOf<String?>(null) }
  var attemptedConnect by rememberSaveable { mutableStateOf(false) }

  val lifecycleOwner = LocalLifecycleOwner.current

  val smsAvailable =
    remember(context) {
      context.packageManager?.hasSystemFeature(PackageManager.FEATURE_TELEPHONY) == true
    }
  val motionAvailable =
    remember(context) {
      hasMotionCapabilities(context)
    }
  val motionPermissionRequired = true
  val notificationsPermissionRequired = Build.VERSION.SDK_INT >= 33
  val discoveryPermission =
    if (Build.VERSION.SDK_INT >= 33) {
      Manifest.permission.NEARBY_WIFI_DEVICES
    } else {
      Manifest.permission.ACCESS_FINE_LOCATION
    }
  val photosPermission =
    if (Build.VERSION.SDK_INT >= 33) {
      Manifest.permission.READ_MEDIA_IMAGES
    } else {
      Manifest.permission.READ_EXTERNAL_STORAGE
    }

  var enableDiscovery by
    rememberSaveable {
      mutableStateOf(isPermissionGranted(context, discoveryPermission))
    }
  var enableLocation by rememberSaveable { mutableStateOf(false) }
  var enableNotifications by
    rememberSaveable {
      mutableStateOf(
        !notificationsPermissionRequired ||
          isPermissionGranted(context, Manifest.permission.POST_NOTIFICATIONS),
      )
    }
  var enableNotificationListener by
    rememberSaveable {
      mutableStateOf(isNotificationListenerEnabled(context))
    }
  var enableAppUpdates by
    rememberSaveable {
      mutableStateOf(canInstallUnknownApps(context))
    }
  var enableMicrophone by rememberSaveable { mutableStateOf(false) }
  var enableCamera by rememberSaveable { mutableStateOf(false) }
  var enablePhotos by rememberSaveable { mutableStateOf(false) }
  var enableContacts by rememberSaveable { mutableStateOf(false) }
  var enableCalendar by rememberSaveable { mutableStateOf(false) }
  var enableMotion by
    rememberSaveable {
      mutableStateOf(
        motionAvailable &&
          (!motionPermissionRequired || isPermissionGranted(context, Manifest.permission.ACTIVITY_RECOGNITION)),
      )
    }
  var enableSms by
    rememberSaveable {
      mutableStateOf(smsAvailable && isPermissionGranted(context, Manifest.permission.SEND_SMS))
    }

  var pendingPermissionToggle by remember { mutableStateOf<PermissionToggle?>(null) }
  var pendingSpecialAccessToggle by remember { mutableStateOf<SpecialAccessToggle?>(null) }

  fun setPermissionToggleEnabled(toggle: PermissionToggle, enabled: Boolean) {
    when (toggle) {
      PermissionToggle.Discovery -> enableDiscovery = enabled
      PermissionToggle.Location -> enableLocation = enabled
      PermissionToggle.Notifications -> enableNotifications = enabled
      PermissionToggle.Microphone -> enableMicrophone = enabled
      PermissionToggle.Camera -> enableCamera = enabled
      PermissionToggle.Photos -> enablePhotos = enabled
      PermissionToggle.Contacts -> enableContacts = enabled
      PermissionToggle.Calendar -> enableCalendar = enabled
      PermissionToggle.Motion -> enableMotion = enabled && motionAvailable
      PermissionToggle.Sms -> enableSms = enabled && smsAvailable
    }
  }

  fun isPermissionToggleGranted(toggle: PermissionToggle): Boolean =
    when (toggle) {
      PermissionToggle.Discovery -> isPermissionGranted(context, discoveryPermission)
      PermissionToggle.Location ->
        isPermissionGranted(context, Manifest.permission.ACCESS_FINE_LOCATION) ||
          isPermissionGranted(context, Manifest.permission.ACCESS_COARSE_LOCATION)
      PermissionToggle.Notifications ->
        !notificationsPermissionRequired ||
          isPermissionGranted(context, Manifest.permission.POST_NOTIFICATIONS)
      PermissionToggle.Microphone -> isPermissionGranted(context, Manifest.permission.RECORD_AUDIO)
      PermissionToggle.Camera -> isPermissionGranted(context, Manifest.permission.CAMERA)
      PermissionToggle.Photos -> isPermissionGranted(context, photosPermission)
      PermissionToggle.Contacts ->
        isPermissionGranted(context, Manifest.permission.READ_CONTACTS) &&
          isPermissionGranted(context, Manifest.permission.WRITE_CONTACTS)
      PermissionToggle.Calendar ->
        isPermissionGranted(context, Manifest.permission.READ_CALENDAR) &&
          isPermissionGranted(context, Manifest.permission.WRITE_CALENDAR)
      PermissionToggle.Motion ->
        !motionAvailable ||
          !motionPermissionRequired ||
          isPermissionGranted(context, Manifest.permission.ACTIVITY_RECOGNITION)
      PermissionToggle.Sms ->
        !smsAvailable || isPermissionGranted(context, Manifest.permission.SEND_SMS)
    }

  fun setSpecialAccessToggleEnabled(toggle: SpecialAccessToggle, enabled: Boolean) {
    when (toggle) {
      SpecialAccessToggle.NotificationListener -> enableNotificationListener = enabled
      SpecialAccessToggle.AppUpdates -> enableAppUpdates = enabled
    }
  }

  val enabledPermissionSummary =
    remember(
      enableDiscovery,
      enableLocation,
      enableNotifications,
      enableNotificationListener,
      enableAppUpdates,
      enableMicrophone,
      enableCamera,
      enablePhotos,
      enableContacts,
      enableCalendar,
      enableMotion,
      enableSms,
      smsAvailable,
      motionAvailable,
    ) {
      val enabled = mutableListOf<String>()
      if (enableDiscovery) enabled += "Gateway discovery"
      if (enableLocation) enabled += "Location"
      if (enableNotifications) enabled += "Notifications"
      if (enableNotificationListener) enabled += "Notification listener"
      if (enableAppUpdates) enabled += "App updates"
      if (enableMicrophone) enabled += "Microphone"
      if (enableCamera) enabled += "Camera"
      if (enablePhotos) enabled += "Photos"
      if (enableContacts) enabled += "Contacts"
      if (enableCalendar) enabled += "Calendar"
      if (enableMotion && motionAvailable) enabled += "Motion"
      if (smsAvailable && enableSms) enabled += "SMS"
      if (enabled.isEmpty()) "None selected" else enabled.joinToString(", ")
    }

  val proceedFromPermissions: () -> Unit = proceed@{
    var openedSpecialSetup = false
    if (enableNotificationListener && !isNotificationListenerEnabled(context)) {
      openNotificationListenerSettings(context)
      openedSpecialSetup = true
    }
    if (enableAppUpdates && !canInstallUnknownApps(context)) {
      openUnknownAppSourcesSettings(context)
      openedSpecialSetup = true
    }
    if (openedSpecialSetup) {
      return@proceed
    }
    step = OnboardingStep.FinalCheck
  }

  val togglePermissionLauncher =
    rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
      val pendingToggle = pendingPermissionToggle ?: return@rememberLauncherForActivityResult
      setPermissionToggleEnabled(pendingToggle, isPermissionToggleGranted(pendingToggle))
      pendingPermissionToggle = null
    }

  val requestPermissionToggle: (PermissionToggle, Boolean, List<String>) -> Unit =
    request@{ toggle, enabled, permissions ->
      if (!enabled) {
        setPermissionToggleEnabled(toggle, false)
        return@request
      }
      if (isPermissionToggleGranted(toggle)) {
        setPermissionToggleEnabled(toggle, true)
        return@request
      }
      val missing = permissions.distinct().filterNot { isPermissionGranted(context, it) }
      if (missing.isEmpty()) {
        setPermissionToggleEnabled(toggle, isPermissionToggleGranted(toggle))
        return@request
      }
      pendingPermissionToggle = toggle
      togglePermissionLauncher.launch(missing.toTypedArray())
    }

  val requestSpecialAccessToggle: (SpecialAccessToggle, Boolean) -> Unit =
    request@{ toggle, enabled ->
      if (!enabled) {
        setSpecialAccessToggleEnabled(toggle, false)
        pendingSpecialAccessToggle = null
        return@request
      }
      val grantedNow =
        when (toggle) {
          SpecialAccessToggle.NotificationListener -> isNotificationListenerEnabled(context)
          SpecialAccessToggle.AppUpdates -> canInstallUnknownApps(context)
        }
      if (grantedNow) {
        setSpecialAccessToggleEnabled(toggle, true)
        pendingSpecialAccessToggle = null
        return@request
      }
      pendingSpecialAccessToggle = toggle
      when (toggle) {
        SpecialAccessToggle.NotificationListener -> openNotificationListenerSettings(context)
        SpecialAccessToggle.AppUpdates -> openUnknownAppSourcesSettings(context)
      }
    }

  DisposableEffect(lifecycleOwner, context, pendingSpecialAccessToggle) {
    val observer =
      LifecycleEventObserver { _, event ->
        if (event != Lifecycle.Event.ON_RESUME) {
          return@LifecycleEventObserver
        }
        when (pendingSpecialAccessToggle) {
          SpecialAccessToggle.NotificationListener -> {
            setSpecialAccessToggleEnabled(
              SpecialAccessToggle.NotificationListener,
              isNotificationListenerEnabled(context),
            )
            pendingSpecialAccessToggle = null
          }
          SpecialAccessToggle.AppUpdates -> {
            setSpecialAccessToggleEnabled(
              SpecialAccessToggle.AppUpdates,
              canInstallUnknownApps(context),
            )
            pendingSpecialAccessToggle = null
          }
          null -> Unit
        }
      }
    lifecycleOwner.lifecycle.addObserver(observer)
    onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
  }

  val qrScanLauncher =
    rememberLauncherForActivityResult(ScanContract()) { result ->
      val contents = result.contents?.trim().orEmpty()
      if (contents.isEmpty()) {
        return@rememberLauncherForActivityResult
      }
      val scannedSetupCode = resolveScannedSetupCode(contents)
      if (scannedSetupCode == null) {
        gatewayError = "QR code did not contain a valid setup code."
        return@rememberLauncherForActivityResult
      }
      setupCode = scannedSetupCode
      gatewayInputMode = GatewayInputMode.SetupCode
      gatewayError = null
      attemptedConnect = false
    }

  if (pendingTrust != null) {
    val prompt = pendingTrust!!
    AlertDialog(
      onDismissRequest = { viewModel.declineGatewayTrustPrompt() },
      title = { Text(stringResource(R.string.onboarding_trust_this_gateway)) },
      text = {
        Text(
          stringResource(
            R.string.onboarding_first_time_tls_connection_verify_this_sha_256_fi,
            prompt.fingerprintSha256,
          ),
        )
      },
      confirmButton = {
        TextButton(onClick = { viewModel.acceptGatewayTrustPrompt() }) {
          Text(stringResource(R.string.onboarding_trust_and_continue))
        }
      },
      dismissButton = {
        TextButton(onClick = { viewModel.declineGatewayTrustPrompt() }) {
          Text(stringResource(R.string.onboarding_cancel))
        }
      },
    )
  }

  Box(
    modifier =
      modifier
        .fillMaxSize()
        .background(Brush.verticalGradient(onboardingBackgroundGradient)),
  ) {
    Column(
      modifier =
        Modifier
          .fillMaxSize()
          .imePadding()
          .windowInsetsPadding(WindowInsets.safeDrawing.only(WindowInsetsSides.Top + WindowInsetsSides.Horizontal))
          .navigationBarsPadding()
          .padding(horizontal = 20.dp, vertical = 12.dp),
      verticalArrangement = Arrangement.SpaceBetween,
    ) {
      Column(
        modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.spacedBy(20.dp),
      ) {
        Column(
          modifier = Modifier.padding(top = 12.dp),
          verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
          Text(
            stringResource(R.string.onboarding_first_run),
            style = onboardingCaption1Style.copy(fontWeight = FontWeight.Bold, letterSpacing = 1.5.sp),
            color = onboardingAccent,
          )
          Text(
            stringResource(R.string.onboarding_openclaw_mobile_setup),
            style = onboardingDisplayStyle.copy(lineHeight = 38.sp),
            color = onboardingText,
          )
          Text(
            stringResource(R.string.onboarding_step_step_index_of_4, step.index),
            style = onboardingCaption1Style,
            color = onboardingAccent,
          )
        }
        StepRailWrap(current = step)

        when (step) {
          OnboardingStep.Welcome -> WelcomeStep()
          OnboardingStep.Gateway ->
            GatewayStep(
              inputMode = gatewayInputMode,
              advancedOpen = gatewayAdvancedOpen,
              setupCode = setupCode,
              manualHost = manualHost,
              manualPort = manualPort,
              manualTls = manualTls,
              gatewayToken = persistedGatewayToken,
              gatewayPassword = gatewayPassword,
              gatewayError = gatewayError,
              onScanQrClick = {
                gatewayError = null
                qrScanLauncher.launch(
                  ScanOptions().apply {
                    setDesiredBarcodeFormats(ScanOptions.QR_CODE)
                    setPrompt("Scan OpenClaw onboarding QR")
                    setBeepEnabled(false)
                    setOrientationLocked(false)
                  },
                )
              },
              onAdvancedOpenChange = { gatewayAdvancedOpen = it },
              onInputModeChange = {
                gatewayInputMode = it
                gatewayError = null
              },
              onSetupCodeChange = {
                setupCode = it
                gatewayError = null
              },
              onManualHostChange = {
                manualHost = it
                gatewayError = null
              },
              onManualPortChange = {
                manualPort = it
                gatewayError = null
              },
              onManualTlsChange = { manualTls = it },
              onTokenChange = viewModel::setGatewayToken,
              onPasswordChange = { gatewayPassword = it },
            )
          OnboardingStep.Permissions ->
            PermissionsStep(
              enableDiscovery = enableDiscovery,
              enableLocation = enableLocation,
              enableNotifications = enableNotifications,
              enableNotificationListener = enableNotificationListener,
              enableAppUpdates = enableAppUpdates,
              enableMicrophone = enableMicrophone,
              enableCamera = enableCamera,
              enablePhotos = enablePhotos,
              enableContacts = enableContacts,
              enableCalendar = enableCalendar,
              enableMotion = enableMotion,
              motionAvailable = motionAvailable,
              motionPermissionRequired = motionPermissionRequired,
              enableSms = enableSms,
              smsAvailable = smsAvailable,
              context = context,
              onDiscoveryChange = { checked ->
                requestPermissionToggle(
                  PermissionToggle.Discovery,
                  checked,
                  listOf(discoveryPermission),
                )
              },
              onLocationChange = { checked ->
                requestPermissionToggle(
                  PermissionToggle.Location,
                  checked,
                  listOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION,
                  ),
                )
              },
              onNotificationsChange = { checked ->
                if (!notificationsPermissionRequired) {
                  setPermissionToggleEnabled(PermissionToggle.Notifications, checked)
                } else {
                  requestPermissionToggle(
                    PermissionToggle.Notifications,
                    checked,
                    listOf(Manifest.permission.POST_NOTIFICATIONS),
                  )
                }
              },
              onNotificationListenerChange = { checked ->
                requestSpecialAccessToggle(SpecialAccessToggle.NotificationListener, checked)
              },
              onAppUpdatesChange = { checked ->
                requestSpecialAccessToggle(SpecialAccessToggle.AppUpdates, checked)
              },
              onMicrophoneChange = { checked ->
                requestPermissionToggle(
                  PermissionToggle.Microphone,
                  checked,
                  listOf(Manifest.permission.RECORD_AUDIO),
                )
              },
              onCameraChange = { checked ->
                requestPermissionToggle(
                  PermissionToggle.Camera,
                  checked,
                  listOf(Manifest.permission.CAMERA),
                )
              },
              onPhotosChange = { checked ->
                requestPermissionToggle(
                  PermissionToggle.Photos,
                  checked,
                  listOf(photosPermission),
                )
              },
              onContactsChange = { checked ->
                requestPermissionToggle(
                  PermissionToggle.Contacts,
                  checked,
                  listOf(
                    Manifest.permission.READ_CONTACTS,
                    Manifest.permission.WRITE_CONTACTS,
                  ),
                )
              },
              onCalendarChange = { checked ->
                requestPermissionToggle(
                  PermissionToggle.Calendar,
                  checked,
                  listOf(
                    Manifest.permission.READ_CALENDAR,
                    Manifest.permission.WRITE_CALENDAR,
                  ),
                )
              },
              onMotionChange = { checked ->
                if (!motionAvailable) {
                  setPermissionToggleEnabled(PermissionToggle.Motion, false)
                } else if (!motionPermissionRequired) {
                  setPermissionToggleEnabled(PermissionToggle.Motion, checked)
                } else {
                  requestPermissionToggle(
                    PermissionToggle.Motion,
                    checked,
                    listOf(Manifest.permission.ACTIVITY_RECOGNITION),
                  )
                }
              },
              onSmsChange = { checked ->
                if (!smsAvailable) {
                  setPermissionToggleEnabled(PermissionToggle.Sms, false)
                } else {
                  requestPermissionToggle(
                    PermissionToggle.Sms,
                    checked,
                    listOf(Manifest.permission.SEND_SMS),
                  )
                }
              },
            )
          OnboardingStep.FinalCheck ->
            FinalStep(
              parsedGateway = parseGatewayEndpoint(gatewayUrl),
              statusText = statusText,
              isConnected = isConnected,
              serverName = serverName,
              remoteAddress = remoteAddress,
              attemptedConnect = attemptedConnect,
              enabledPermissions = enabledPermissionSummary,
              methodLabel = if (gatewayInputMode == GatewayInputMode.SetupCode) "QR / Setup Code" else "Manual",
            )
        }
      }

      Spacer(Modifier.height(12.dp))

      Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        val backEnabled = step != OnboardingStep.Welcome
        Surface(
          modifier = Modifier.size(52.dp),
          shape = RoundedCornerShape(14.dp),
          color = onboardingSurface,
          border = androidx.compose.foundation.BorderStroke(1.dp, if (backEnabled) onboardingBorderStrong else onboardingBorder),
        ) {
          IconButton(
            onClick = {
              step =
                when (step) {
                  OnboardingStep.Welcome -> OnboardingStep.Welcome
                  OnboardingStep.Gateway -> OnboardingStep.Welcome
                  OnboardingStep.Permissions -> OnboardingStep.Gateway
                  OnboardingStep.FinalCheck -> OnboardingStep.Permissions
                }
            },
            enabled = backEnabled,
          ) {
            Icon(
              Icons.AutoMirrored.Filled.ArrowBack,
              contentDescription = stringResource(R.string.onboarding_back),
              tint = if (backEnabled) onboardingTextSecondary else onboardingTextTertiary,
            )
          }
        }

        when (step) {
          OnboardingStep.Welcome -> {
            Button(
              onClick = { step = OnboardingStep.Gateway },
              modifier = Modifier.weight(1f).height(52.dp),
              shape = RoundedCornerShape(14.dp),
              colors =
                ButtonDefaults.buttonColors(
                  containerColor = onboardingAccent,
                  contentColor = Color.White,
                  disabledContainerColor = onboardingAccent.copy(alpha = 0.45f),
                  disabledContentColor = Color.White,
                ),
            ) {
              Text(stringResource(R.string.onboarding_next), style = onboardingHeadlineStyle.copy(fontWeight = FontWeight.Bold))
            }
          }
          OnboardingStep.Gateway -> {
            Button(
              onClick = {
                if (gatewayInputMode == GatewayInputMode.SetupCode) {
                  val parsedSetup = decodeGatewaySetupCode(setupCode)
                  if (parsedSetup == null) {
                    gatewayError = "Scan QR code first, or use Advanced setup."
                    return@Button
                  }
                  val parsedGateway = parseGatewayEndpoint(parsedSetup.url)
                  if (parsedGateway == null) {
                    gatewayError = "Setup code has invalid gateway URL."
                    return@Button
                  }
                  gatewayUrl = parsedSetup.url
                  parsedSetup.token?.let { viewModel.setGatewayToken(it) }
                  gatewayPassword = parsedSetup.password.orEmpty()
                } else {
                  val manualUrl = composeGatewayManualUrl(manualHost, manualPort, manualTls)
                  val parsedGateway = manualUrl?.let(::parseGatewayEndpoint)
                  if (parsedGateway == null) {
                    gatewayError = "Manual endpoint is invalid."
                    return@Button
                  }
                  gatewayUrl = parsedGateway.displayUrl
                }
                step = OnboardingStep.Permissions
              },
              modifier = Modifier.weight(1f).height(52.dp),
              shape = RoundedCornerShape(14.dp),
              colors =
                ButtonDefaults.buttonColors(
                  containerColor = onboardingAccent,
                  contentColor = Color.White,
                  disabledContainerColor = onboardingAccent.copy(alpha = 0.45f),
                  disabledContentColor = Color.White,
                ),
            ) {
              Text(stringResource(R.string.onboarding_next_2), style = onboardingHeadlineStyle.copy(fontWeight = FontWeight.Bold))
            }
          }
          OnboardingStep.Permissions -> {
            Button(
              onClick = {
                viewModel.setCameraEnabled(enableCamera)
                viewModel.setLocationMode(if (enableLocation) LocationMode.WhileUsing else LocationMode.Off)
                proceedFromPermissions()
              },
              modifier = Modifier.weight(1f).height(52.dp),
              shape = RoundedCornerShape(14.dp),
              colors =
                ButtonDefaults.buttonColors(
                  containerColor = onboardingAccent,
                  contentColor = Color.White,
                  disabledContainerColor = onboardingAccent.copy(alpha = 0.45f),
                  disabledContentColor = Color.White,
                ),
            ) {
              Text(stringResource(R.string.onboarding_next_3), style = onboardingHeadlineStyle.copy(fontWeight = FontWeight.Bold))
            }
          }
          OnboardingStep.FinalCheck -> {
            if (isConnected) {
              Button(
                onClick = { viewModel.setOnboardingCompleted(true) },
                modifier = Modifier.weight(1f).height(52.dp),
                shape = RoundedCornerShape(14.dp),
                colors =
                  ButtonDefaults.buttonColors(
                    containerColor = onboardingAccent,
                    contentColor = Color.White,
                    disabledContainerColor = onboardingAccent.copy(alpha = 0.45f),
                    disabledContentColor = Color.White,
                  ),
              ) {
                Text(stringResource(R.string.onboarding_finish), style = onboardingHeadlineStyle.copy(fontWeight = FontWeight.Bold))
              }
            } else {
              Button(
                onClick = {
                  val parsed = parseGatewayEndpoint(gatewayUrl)
                  if (parsed == null) {
                    step = OnboardingStep.Gateway
                    gatewayError = "Invalid gateway URL."
                    return@Button
                  }
                  val token = persistedGatewayToken.trim()
                  val password = gatewayPassword.trim()
                  attemptedConnect = true
                  viewModel.setManualEnabled(true)
                  viewModel.setManualHost(parsed.host)
                  viewModel.setManualPort(parsed.port)
                  viewModel.setManualTls(parsed.tls)
                  if (token.isNotEmpty()) {
                    viewModel.setGatewayToken(token)
                  }
                  viewModel.setGatewayPassword(password)
                  viewModel.connectManual()
                },
                modifier = Modifier.weight(1f).height(52.dp),
                shape = RoundedCornerShape(14.dp),
                colors =
                  ButtonDefaults.buttonColors(
                    containerColor = onboardingAccent,
                    contentColor = Color.White,
                    disabledContainerColor = onboardingAccent.copy(alpha = 0.45f),
                    disabledContentColor = Color.White,
                  ),
              ) {
                Text(stringResource(R.string.onboarding_connect), style = onboardingHeadlineStyle.copy(fontWeight = FontWeight.Bold))
              }
            }
          }
        }
      }
    }
  }
}

@Composable
private fun StepRailWrap(current: OnboardingStep) {
  Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
    HorizontalDivider(color = onboardingBorder)
    StepRail(current = current)
    HorizontalDivider(color = onboardingBorder)
  }
}

@Composable
private fun StepRail(current: OnboardingStep) {
  val steps = OnboardingStep.entries
  Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
    steps.forEach { step ->
      val complete = step.index < current.index
      val active = step.index == current.index
      Column(
        modifier = Modifier.weight(1f),
        verticalArrangement = Arrangement.spacedBy(4.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
      ) {
        Box(
          modifier =
            Modifier
              .fillMaxWidth()
              .height(5.dp)
              .background(
                color =
                  when {
                    complete -> onboardingSuccess
                    active -> onboardingAccent
                    else -> onboardingBorder
                  },
                shape = RoundedCornerShape(999.dp),
              ),
        )
        Text(
          text = step.label,
          style = onboardingCaption2Style.copy(fontWeight = if (active) FontWeight.Bold else FontWeight.SemiBold),
          color = if (active) onboardingAccent else onboardingTextSecondary,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
        )
      }
    }
  }
}

@Composable
private fun WelcomeStep() {
  StepShell(title = stringResource(R.string.onboarding_what_you_get)) {
    Bullet("Control the gateway and operator chat from one mobile surface.")
    Bullet("Connect with setup code and recover pairing with CLI commands.")
    Bullet("Enable only the permissions and capabilities you want.")
    Bullet("Finish with a real connection check before entering the app.")
  }
}

@Composable
private fun GatewayStep(
  inputMode: GatewayInputMode,
  advancedOpen: Boolean,
  setupCode: String,
  manualHost: String,
  manualPort: String,
  manualTls: Boolean,
  gatewayToken: String,
  gatewayPassword: String,
  gatewayError: String?,
  onScanQrClick: () -> Unit,
  onAdvancedOpenChange: (Boolean) -> Unit,
  onInputModeChange: (GatewayInputMode) -> Unit,
  onSetupCodeChange: (String) -> Unit,
  onManualHostChange: (String) -> Unit,
  onManualPortChange: (String) -> Unit,
  onManualTlsChange: (Boolean) -> Unit,
  onTokenChange: (String) -> Unit,
  onPasswordChange: (String) -> Unit,
) {
  val resolvedEndpoint = remember(setupCode) { decodeGatewaySetupCode(setupCode)?.url?.let { parseGatewayEndpoint(it)?.displayUrl } }
  val manualResolvedEndpoint = remember(manualHost, manualPort, manualTls) { composeGatewayManualUrl(manualHost, manualPort, manualTls)?.let { parseGatewayEndpoint(it)?.displayUrl } }

  StepShell(title = stringResource(R.string.onboarding_gateway_connection)) {
    GuideBlock(title = stringResource(R.string.onboarding_scan_onboarding_qr)) {
      Text(stringResource(R.string.onboarding_run_these_on_the_gateway_host), style = onboardingCalloutStyle, color = onboardingTextSecondary)
      CommandBlock("paleoclaw qr")
      Text(stringResource(R.string.onboarding_then_scan_with_this_device), style = onboardingCalloutStyle, color = onboardingTextSecondary)
    }
    Button(
      onClick = onScanQrClick,
      modifier = Modifier.fillMaxWidth().height(48.dp),
      shape = RoundedCornerShape(12.dp),
      colors =
        ButtonDefaults.buttonColors(
          containerColor = onboardingAccent,
          contentColor = Color.White,
        ),
    ) {
      Text(stringResource(R.string.onboarding_scan_qr_code), style = onboardingHeadlineStyle.copy(fontWeight = FontWeight.Bold))
    }
    if (!resolvedEndpoint.isNullOrBlank()) {
      Text(stringResource(R.string.onboarding_qr_captured_review_endpoint_below), style = onboardingCalloutStyle, color = onboardingSuccess)
      ResolvedEndpoint(endpoint = resolvedEndpoint)
    }

    Surface(
      modifier = Modifier.fillMaxWidth(),
      shape = RoundedCornerShape(12.dp),
      color = onboardingSurface,
      border = androidx.compose.foundation.BorderStroke(1.dp, onboardingBorderStrong),
      onClick = { onAdvancedOpenChange(!advancedOpen) },
    ) {
      Row(
        modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.SpaceBetween,
      ) {
        Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
          Text(stringResource(R.string.onboarding_advanced_setup), style = onboardingHeadlineStyle, color = onboardingText)
          Text(stringResource(R.string.onboarding_paste_setup_code_or_enter_host_port_manually), style = onboardingCaption1Style, color = onboardingTextSecondary)
        }
        Icon(
          imageVector = if (advancedOpen) Icons.Default.ExpandLess else Icons.Default.ExpandMore,
          contentDescription = if (advancedOpen) "Collapse advanced setup" else "Expand advanced setup",
          tint = onboardingTextSecondary,
        )
      }
    }

    AnimatedVisibility(visible = advancedOpen) {
      Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        GuideBlock(title = stringResource(R.string.onboarding_manual_setup_commands)) {
          Text(stringResource(R.string.onboarding_run_these_on_the_gateway_host_2), style = onboardingCalloutStyle, color = onboardingTextSecondary)
          CommandBlock("paleoclaw qr --setup-code-only")
          CommandBlock("paleoclaw qr --json")
          Text(
            stringResource(R.string.onboarding_json_prints_setupcode_and_gatewayurl),
            style = onboardingCalloutStyle,
            color = onboardingTextSecondary,
          )
          Text(
            stringResource(R.string.onboarding_auto_url_discovery_is_not_wired_yet_android_emul),
            style = onboardingCalloutStyle,
            color = onboardingTextSecondary,
          )
        }
        GatewayModeToggle(inputMode = inputMode, onInputModeChange = onInputModeChange)

        if (inputMode == GatewayInputMode.SetupCode) {
          Text(stringResource(R.string.onboarding_setup_code), style = onboardingCaption1Style.copy(letterSpacing = 0.9.sp), color = onboardingTextSecondary)
          OutlinedTextField(
            value = setupCode,
            onValueChange = onSetupCodeChange,
            placeholder = { Text(stringResource(R.string.onboarding_paste_code_from_openclaw_qr_setup_code_only), color = onboardingTextTertiary, style = onboardingBodyStyle) },
            modifier = Modifier.fillMaxWidth(),
            minLines = 3,
            maxLines = 5,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
            textStyle = onboardingBodyStyle.copy(fontFamily = FontFamily.Monospace, color = onboardingText),
            shape = RoundedCornerShape(14.dp),
            colors =
              OutlinedTextFieldDefaults.colors(
                focusedContainerColor = onboardingSurface,
                unfocusedContainerColor = onboardingSurface,
                focusedBorderColor = onboardingAccent,
                unfocusedBorderColor = onboardingBorder,
                focusedTextColor = onboardingText,
                unfocusedTextColor = onboardingText,
                cursorColor = onboardingAccent,
              ),
          )
          if (!resolvedEndpoint.isNullOrBlank()) {
            ResolvedEndpoint(endpoint = resolvedEndpoint)
          }
        } else {
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            QuickFillChip(label = stringResource(R.string.onboarding_android_emulator), onClick = {
              onManualHostChange("10.0.2.2")
              onManualPortChange("18789")
              onManualTlsChange(false)
            })
            QuickFillChip(label = stringResource(R.string.onboarding_localhost), onClick = {
              onManualHostChange("127.0.0.1")
              onManualPortChange("18789")
              onManualTlsChange(false)
            })
          }

          Text(stringResource(R.string.onboarding_host), style = onboardingCaption1Style.copy(letterSpacing = 0.9.sp), color = onboardingTextSecondary)
          OutlinedTextField(
            value = manualHost,
            onValueChange = onManualHostChange,
            placeholder = { Text(stringResource(R.string.onboarding_10_0_2_2), color = onboardingTextTertiary, style = onboardingBodyStyle) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
            textStyle = onboardingBodyStyle.copy(color = onboardingText),
            shape = RoundedCornerShape(14.dp),
            colors =
              OutlinedTextFieldDefaults.colors(
                focusedContainerColor = onboardingSurface,
                unfocusedContainerColor = onboardingSurface,
                focusedBorderColor = onboardingAccent,
                unfocusedBorderColor = onboardingBorder,
                focusedTextColor = onboardingText,
                unfocusedTextColor = onboardingText,
                cursorColor = onboardingAccent,
              ),
          )

          Text(stringResource(R.string.onboarding_port), style = onboardingCaption1Style.copy(letterSpacing = 0.9.sp), color = onboardingTextSecondary)
          OutlinedTextField(
            value = manualPort,
            onValueChange = onManualPortChange,
            placeholder = { Text(stringResource(R.string.onboarding_18789), color = onboardingTextTertiary, style = onboardingBodyStyle) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
            textStyle = onboardingBodyStyle.copy(fontFamily = FontFamily.Monospace, color = onboardingText),
            shape = RoundedCornerShape(14.dp),
            colors =
              OutlinedTextFieldDefaults.colors(
                focusedContainerColor = onboardingSurface,
                unfocusedContainerColor = onboardingSurface,
                focusedBorderColor = onboardingAccent,
                unfocusedBorderColor = onboardingBorder,
                focusedTextColor = onboardingText,
                unfocusedTextColor = onboardingText,
                cursorColor = onboardingAccent,
              ),
          )

          Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
          ) {
            Column(verticalArrangement = Arrangement.spacedBy(2.dp)) {
              Text(stringResource(R.string.onboarding_use_tls), style = onboardingHeadlineStyle, color = onboardingText)
              Text(stringResource(R.string.onboarding_switch_to_secure_websocket_wss), style = onboardingCalloutStyle.copy(lineHeight = 18.sp), color = onboardingTextSecondary)
            }
            Switch(
              checked = manualTls,
              onCheckedChange = onManualTlsChange,
              colors =
                SwitchDefaults.colors(
                  checkedTrackColor = onboardingAccent,
                  uncheckedTrackColor = onboardingBorderStrong,
                  checkedThumbColor = Color.White,
                  uncheckedThumbColor = Color.White,
                ),
            )
          }

          Text(stringResource(R.string.onboarding_token_optional), style = onboardingCaption1Style.copy(letterSpacing = 0.9.sp), color = onboardingTextSecondary)
          OutlinedTextField(
            value = gatewayToken,
            onValueChange = onTokenChange,
            placeholder = { Text(stringResource(R.string.onboarding_token), color = onboardingTextTertiary, style = onboardingBodyStyle) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
            textStyle = onboardingBodyStyle.copy(color = onboardingText),
            shape = RoundedCornerShape(14.dp),
            colors =
              OutlinedTextFieldDefaults.colors(
                focusedContainerColor = onboardingSurface,
                unfocusedContainerColor = onboardingSurface,
                focusedBorderColor = onboardingAccent,
                unfocusedBorderColor = onboardingBorder,
                focusedTextColor = onboardingText,
                unfocusedTextColor = onboardingText,
                cursorColor = onboardingAccent,
              ),
          )

          Text(stringResource(R.string.onboarding_password_optional), style = onboardingCaption1Style.copy(letterSpacing = 0.9.sp), color = onboardingTextSecondary)
          OutlinedTextField(
            value = gatewayPassword,
            onValueChange = onPasswordChange,
            placeholder = { Text(stringResource(R.string.onboarding_password), color = onboardingTextTertiary, style = onboardingBodyStyle) },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii),
            textStyle = onboardingBodyStyle.copy(color = onboardingText),
            shape = RoundedCornerShape(14.dp),
            colors =
              OutlinedTextFieldDefaults.colors(
                focusedContainerColor = onboardingSurface,
                unfocusedContainerColor = onboardingSurface,
                focusedBorderColor = onboardingAccent,
                unfocusedBorderColor = onboardingBorder,
                focusedTextColor = onboardingText,
                unfocusedTextColor = onboardingText,
                cursorColor = onboardingAccent,
              ),
          )

          if (!manualResolvedEndpoint.isNullOrBlank()) {
            ResolvedEndpoint(endpoint = manualResolvedEndpoint)
          }
        }
      }
    }

    if (!gatewayError.isNullOrBlank()) {
      Text(gatewayError, color = onboardingWarning, style = onboardingCaption1Style)
    }
  }
}

@Composable
private fun GuideBlock(
  title: String,
  content: @Composable ColumnScope.() -> Unit,
) {
  Row(modifier = Modifier.fillMaxWidth().height(IntrinsicSize.Min), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
    Box(modifier = Modifier.width(2.dp).fillMaxHeight().background(onboardingAccent.copy(alpha = 0.4f)))
    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(8.dp)) {
      Text(title, style = onboardingHeadlineStyle, color = onboardingText)
      content()
    }
  }
}

@Composable
private fun GatewayModeToggle(
  inputMode: GatewayInputMode,
  onInputModeChange: (GatewayInputMode) -> Unit,
) {
  Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
    GatewayModeChip(
      label = stringResource(R.string.onboarding_setup_code_2),
      active = inputMode == GatewayInputMode.SetupCode,
      onClick = { onInputModeChange(GatewayInputMode.SetupCode) },
      modifier = Modifier.weight(1f),
    )
    GatewayModeChip(
      label = stringResource(R.string.onboarding_manual),
      active = inputMode == GatewayInputMode.Manual,
      onClick = { onInputModeChange(GatewayInputMode.Manual) },
      modifier = Modifier.weight(1f),
    )
  }
}

@Composable
private fun GatewayModeChip(
  label: String,
  active: Boolean,
  onClick: () -> Unit,
  modifier: Modifier = Modifier,
) {
  Button(
    onClick = onClick,
    modifier = modifier.height(40.dp),
    shape = RoundedCornerShape(12.dp),
    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 8.dp),
    colors =
      ButtonDefaults.buttonColors(
        containerColor = if (active) onboardingAccent else onboardingSurface,
        contentColor = if (active) Color.White else onboardingText,
      ),
    border = androidx.compose.foundation.BorderStroke(1.dp, if (active) Color(0xFF184DAF) else onboardingBorderStrong),
  ) {
    Text(
      text = label,
      style = onboardingCaption1Style.copy(fontWeight = FontWeight.Bold),
    )
  }
}

@Composable
private fun QuickFillChip(
  label: String,
  onClick: () -> Unit,
) {
  TextButton(
    onClick = onClick,
    shape = RoundedCornerShape(999.dp),
    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 7.dp),
    colors =
      ButtonDefaults.textButtonColors(
        containerColor = onboardingAccentSoft,
        contentColor = onboardingAccent,
      ),
  ) {
    Text(label, style = onboardingCaption1Style.copy(fontWeight = FontWeight.SemiBold))
  }
}

@Composable
private fun ResolvedEndpoint(endpoint: String) {
  Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
    HorizontalDivider(color = onboardingBorder)
    Text(
      stringResource(R.string.onboarding_resolved_endpoint),
      style = onboardingCaption2Style.copy(fontWeight = FontWeight.SemiBold, letterSpacing = 0.7.sp),
      color = onboardingTextSecondary,
    )
    Text(
      endpoint,
      style = onboardingCalloutStyle.copy(fontFamily = FontFamily.Monospace),
      color = onboardingText,
    )
    HorizontalDivider(color = onboardingBorder)
  }
}

@Composable
private fun StepShell(
  title: String,
  content: @Composable ColumnScope.() -> Unit,
) {
  Column(verticalArrangement = Arrangement.spacedBy(0.dp)) {
    HorizontalDivider(color = onboardingBorder)
    Column(modifier = Modifier.padding(vertical = 14.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      Text(title, style = onboardingTitle1Style, color = onboardingText)
      content()
    }
    HorizontalDivider(color = onboardingBorder)
  }
}

@Composable
private fun InlineDivider() {
  HorizontalDivider(color = onboardingBorder)
}

@Composable
private fun PermissionsStep(
  enableDiscovery: Boolean,
  enableLocation: Boolean,
  enableNotifications: Boolean,
  enableNotificationListener: Boolean,
  enableAppUpdates: Boolean,
  enableMicrophone: Boolean,
  enableCamera: Boolean,
  enablePhotos: Boolean,
  enableContacts: Boolean,
  enableCalendar: Boolean,
  enableMotion: Boolean,
  motionAvailable: Boolean,
  motionPermissionRequired: Boolean,
  enableSms: Boolean,
  smsAvailable: Boolean,
  context: Context,
  onDiscoveryChange: (Boolean) -> Unit,
  onLocationChange: (Boolean) -> Unit,
  onNotificationsChange: (Boolean) -> Unit,
  onNotificationListenerChange: (Boolean) -> Unit,
  onAppUpdatesChange: (Boolean) -> Unit,
  onMicrophoneChange: (Boolean) -> Unit,
  onCameraChange: (Boolean) -> Unit,
  onPhotosChange: (Boolean) -> Unit,
  onContactsChange: (Boolean) -> Unit,
  onCalendarChange: (Boolean) -> Unit,
  onMotionChange: (Boolean) -> Unit,
  onSmsChange: (Boolean) -> Unit,
) {
  val discoveryPermission = if (Build.VERSION.SDK_INT >= 33) Manifest.permission.NEARBY_WIFI_DEVICES else Manifest.permission.ACCESS_FINE_LOCATION
  val locationGranted =
    isPermissionGranted(context, Manifest.permission.ACCESS_FINE_LOCATION) ||
      isPermissionGranted(context, Manifest.permission.ACCESS_COARSE_LOCATION)
  val photosPermission =
    if (Build.VERSION.SDK_INT >= 33) {
      Manifest.permission.READ_MEDIA_IMAGES
    } else {
      Manifest.permission.READ_EXTERNAL_STORAGE
    }
  val contactsGranted =
    isPermissionGranted(context, Manifest.permission.READ_CONTACTS) &&
      isPermissionGranted(context, Manifest.permission.WRITE_CONTACTS)
  val calendarGranted =
    isPermissionGranted(context, Manifest.permission.READ_CALENDAR) &&
      isPermissionGranted(context, Manifest.permission.WRITE_CALENDAR)
  val motionGranted =
    if (!motionAvailable) {
      false
    } else if (!motionPermissionRequired) {
      true
    } else {
      isPermissionGranted(context, Manifest.permission.ACTIVITY_RECOGNITION)
    }
  val notificationListenerGranted = isNotificationListenerEnabled(context)
  val appUpdatesGranted = canInstallUnknownApps(context)

  StepShell(title = stringResource(R.string.onboarding_permissions)) {
    Text(
      stringResource(R.string.onboarding_enable_only_what_you_need_now_you_can_change_eve),
      style = onboardingCalloutStyle,
      color = onboardingTextSecondary,
    )
    PermissionToggleRow(
      title = stringResource(R.string.onboarding_gateway_discovery),
      subtitle = if (Build.VERSION.SDK_INT >= 33) "Nearby devices" else "Location (for NSD)",
      checked = enableDiscovery,
      granted = isPermissionGranted(context, discoveryPermission),
      onCheckedChange = onDiscoveryChange,
    )
    InlineDivider()
    PermissionToggleRow(
      title = stringResource(R.string.onboarding_location),
      subtitle = stringResource(R.string.onboarding_location_get_while_app_is_open_unless_set_to_alw),
      checked = enableLocation,
      granted = locationGranted,
      onCheckedChange = onLocationChange,
    )
    InlineDivider()
    if (Build.VERSION.SDK_INT >= 33) {
      PermissionToggleRow(
        title = stringResource(R.string.onboarding_notifications),
        subtitle = stringResource(R.string.onboarding_system_notify_and_foreground_alerts),
        checked = enableNotifications,
        granted = isPermissionGranted(context, Manifest.permission.POST_NOTIFICATIONS),
        onCheckedChange = onNotificationsChange,
      )
      InlineDivider()
    }
    PermissionToggleRow(
      title = stringResource(R.string.onboarding_notification_listener),
      subtitle = stringResource(R.string.onboarding_notifications_list_and_notifications_actions_ope),
      checked = enableNotificationListener,
      granted = notificationListenerGranted,
      onCheckedChange = onNotificationListenerChange,
    )
    InlineDivider()
    PermissionToggleRow(
      title = stringResource(R.string.onboarding_app_updates),
      subtitle = stringResource(R.string.onboarding_app_update_install_confirmation_opens_android_se),
      checked = enableAppUpdates,
      granted = appUpdatesGranted,
      onCheckedChange = onAppUpdatesChange,
    )
    InlineDivider()
    PermissionToggleRow(
      title = stringResource(R.string.onboarding_microphone),
      subtitle = stringResource(R.string.onboarding_voice_tab_transcription),
      checked = enableMicrophone,
      granted = isPermissionGranted(context, Manifest.permission.RECORD_AUDIO),
      onCheckedChange = onMicrophoneChange,
    )
    InlineDivider()
    PermissionToggleRow(
      title = stringResource(R.string.onboarding_camera),
      subtitle = stringResource(R.string.onboarding_camera_snap_and_camera_clip),
      checked = enableCamera,
      granted = isPermissionGranted(context, Manifest.permission.CAMERA),
      onCheckedChange = onCameraChange,
    )
    InlineDivider()
    PermissionToggleRow(
      title = stringResource(R.string.onboarding_photos),
      subtitle = stringResource(R.string.onboarding_photos_latest),
      checked = enablePhotos,
      granted = isPermissionGranted(context, photosPermission),
      onCheckedChange = onPhotosChange,
    )
    InlineDivider()
    PermissionToggleRow(
      title = stringResource(R.string.onboarding_contacts),
      subtitle = stringResource(R.string.onboarding_contacts_search_and_contacts_add),
      checked = enableContacts,
      granted = contactsGranted,
      onCheckedChange = onContactsChange,
    )
    InlineDivider()
    PermissionToggleRow(
      title = stringResource(R.string.onboarding_calendar),
      subtitle = stringResource(R.string.onboarding_calendar_events_and_calendar_add),
      checked = enableCalendar,
      granted = calendarGranted,
      onCheckedChange = onCalendarChange,
    )
    InlineDivider()
    PermissionToggleRow(
      title = stringResource(R.string.onboarding_motion),
      subtitle = stringResource(R.string.onboarding_motion_activity_and_motion_pedometer),
      checked = enableMotion,
      granted = motionGranted,
      onCheckedChange = onMotionChange,
      enabled = motionAvailable,
      statusOverride = if (!motionAvailable) "Unavailable on this device" else null,
    )
    if (smsAvailable) {
      InlineDivider()
      PermissionToggleRow(
        title = stringResource(R.string.onboarding_sms),
        subtitle = stringResource(R.string.onboarding_allow_gateway_triggered_sms_sending),
        checked = enableSms,
        granted = isPermissionGranted(context, Manifest.permission.SEND_SMS),
        onCheckedChange = onSmsChange,
      )
    }
    Text(stringResource(R.string.onboarding_all_settings_can_be_changed_later_in_settings), style = onboardingCalloutStyle, color = onboardingTextSecondary)
  }
}

@Composable
private fun PermissionToggleRow(
  title: String,
  subtitle: String,
  checked: Boolean,
  granted: Boolean,
  enabled: Boolean = true,
  statusOverride: String? = null,
  onCheckedChange: (Boolean) -> Unit,
) {
  Row(
    modifier = Modifier.fillMaxWidth().heightIn(min = 50.dp),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
      Text(title, style = onboardingHeadlineStyle, color = onboardingText)
      Text(subtitle, style = onboardingCalloutStyle.copy(lineHeight = 18.sp), color = onboardingTextSecondary)
      Text(
        statusOverride ?: if (granted) "Granted" else "Not granted",
        style = onboardingCaption1Style,
        color = if (granted) onboardingSuccess else onboardingTextSecondary,
      )
    }
    Switch(
      checked = checked,
      onCheckedChange = onCheckedChange,
      enabled = enabled,
      colors =
        SwitchDefaults.colors(
          checkedTrackColor = onboardingAccent,
          uncheckedTrackColor = onboardingBorderStrong,
          checkedThumbColor = Color.White,
          uncheckedThumbColor = Color.White,
        ),
    )
  }
}

@Composable
private fun FinalStep(
  parsedGateway: GatewayEndpointConfig?,
  statusText: String,
  isConnected: Boolean,
  serverName: String?,
  remoteAddress: String?,
  attemptedConnect: Boolean,
  enabledPermissions: String,
  methodLabel: String,
) {
  StepShell(title = stringResource(R.string.onboarding_review)) {
    SummaryField(label = stringResource(R.string.onboarding_method), value = methodLabel)
    SummaryField(label = stringResource(R.string.onboarding_gateway), value = parsedGateway?.displayUrl ?: "Invalid gateway URL")
    SummaryField(label = stringResource(R.string.onboarding_enabled_permissions), value = enabledPermissions)

    if (!attemptedConnect) {
      Text(stringResource(R.string.onboarding_press_connect_to_verify_gateway_reachability_and), style = onboardingCalloutStyle, color = onboardingTextSecondary)
    } else {
      Text(stringResource(R.string.onboarding_status_statustext, statusText), style = onboardingCalloutStyle, color = if (isConnected) onboardingSuccess else onboardingTextSecondary)
      if (isConnected) {
        Text(stringResource(R.string.onboarding_connected_to_servername_remoteaddress, serverName ?: remoteAddress ?: "gateway"), style = onboardingCalloutStyle, color = onboardingSuccess)
      } else {
        GuideBlock(title = stringResource(R.string.onboarding_pairing_required)) {
          Text(stringResource(R.string.onboarding_run_these_on_the_gateway_host_3), style = onboardingCalloutStyle, color = onboardingTextSecondary)
          CommandBlock("paleoclaw devices list")
          CommandBlock("paleoclaw devices approve <requestId>")
          Text(stringResource(R.string.onboarding_then_tap_connect_again), style = onboardingCalloutStyle, color = onboardingTextSecondary)
        }
      }
    }
  }
}

@Composable
private fun SummaryField(label: String, value: String) {
  Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
    Text(
      label,
      style = onboardingCaption2Style.copy(fontWeight = FontWeight.SemiBold, letterSpacing = 0.6.sp),
      color = onboardingTextSecondary,
    )
    Text(value, style = onboardingHeadlineStyle, color = onboardingText)
    HorizontalDivider(color = onboardingBorder)
  }
}

@Composable
private fun CommandBlock(command: String) {
  Row(
    modifier =
      Modifier
        .fillMaxWidth()
        .background(onboardingCommandBg, RoundedCornerShape(12.dp))
        .border(width = 1.dp, color = onboardingCommandBorder, shape = RoundedCornerShape(12.dp)),
  ) {
    Box(modifier = Modifier.width(3.dp).height(42.dp).background(onboardingCommandAccent))
    Text(
      command,
      modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
      style = onboardingCalloutStyle,
      fontFamily = FontFamily.Monospace,
      color = onboardingCommandText,
    )
  }
}

@Composable
private fun Bullet(text: String) {
  Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top) {
    Box(
      modifier =
        Modifier
          .padding(top = 7.dp)
          .size(8.dp)
          .background(onboardingAccentSoft, CircleShape),
    )
    Box(
      modifier =
        Modifier
          .padding(top = 9.dp)
          .size(4.dp)
          .background(onboardingAccent, CircleShape),
    )
    Text(text, style = onboardingBodyStyle, color = onboardingTextSecondary, modifier = Modifier.weight(1f))
  }
}

private fun isPermissionGranted(context: Context, permission: String): Boolean {
  return ContextCompat.checkSelfPermission(context, permission) == PackageManager.PERMISSION_GRANTED
}

private fun isNotificationListenerEnabled(context: Context): Boolean {
  return DeviceNotificationListenerService.isAccessEnabled(context)
}

private fun canInstallUnknownApps(context: Context): Boolean {
  return context.packageManager.canRequestPackageInstalls()
}

private fun openNotificationListenerSettings(context: Context) {
  val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
  runCatching {
    context.startActivity(intent)
  }.getOrElse {
    openAppSettings(context)
  }
}

private fun openUnknownAppSourcesSettings(context: Context) {
  val intent =
    Intent(
      Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
      "package:${context.packageName}".toUri(),
    ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
  runCatching {
    context.startActivity(intent)
  }.getOrElse {
    openAppSettings(context)
  }
}

private fun openAppSettings(context: Context) {
  val intent =
    Intent(
      Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
      Uri.fromParts("package", context.packageName, null),
    ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
  context.startActivity(intent)
}

private fun hasMotionCapabilities(context: Context): Boolean {
  val sensorManager = context.getSystemService(SensorManager::class.java) ?: return false
  return sensorManager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) != null ||
    sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER) != null
}
