import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { colors } from '@/constants/colors';
import { fonts, textSize } from '@/constants/typography';
import { env } from '@/lib/config/env';
import { getRecaptchaWebViewBaseUrl } from '@/lib/firebase/recaptcha-webview-base-url';
import type {
  FirebaseRecaptchaVerifierHandle,
  FirebaseRecaptchaVerifierProps,
  NativeCaptchaMeta,
} from './firebase-recaptcha.types';

export type { FirebaseRecaptchaVerifierHandle, FirebaseRecaptchaVerifierProps };

type Props = FirebaseRecaptchaVerifierProps & {
  attemptInvisibleVerification?: boolean;
  title?: string;
  cancelLabel?: string;
};

const RECAPTCHA_VERIFY_TIMEOUT_MS = 90_000;

const WEBVIEW_PROPS = {
  javaScriptEnabled: true,
  domStorageEnabled: true,
  sharedCookiesEnabled: true,
  thirdPartyCookiesEnabled: true,
  originWhitelist: ['*'] as string[],
  mixedContentMode: 'always' as const,
  cacheEnabled: true,
  setSupportMultipleWindows: false,
};

function buildRecaptchaHtml(invisible: boolean): string {
  const apiKey = JSON.stringify(env.firebase.apiKey);
  const containerId = invisible ? 'recaptcha-btn' : 'recaptcha-cont';
  const size = invisible ? 'invisible' : 'normal';
  const bodyMarkup = invisible
    ? '<button type="button" id="recaptcha-btn">Verify</button>'
    : '<div id="recaptcha-cont"></div>';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    html, body { height: 100%; margin: 0; padding: 0; background: #fff; ${invisible ? '' : 'padding: 8px;'} }
    #recaptcha-btn { width: 100%; min-height: 48px; border: 0; padding: 0; margin: 0; }
    #recaptcha-cont { min-height: 78px; }
    #status { font: 14px/1.4 sans-serif; color: #444; padding: 8px; text-align: center; }
  </style>
</head>
<body>
  ${bodyMarkup}
  <div id="status">Loading security check…</div>
  <script>
    (function () {
      var apiKey = ${apiKey};
      var containerId = '${containerId}';
      var size = '${size}';

      function post(type, extra) {
        if (!window.ReactNativeWebView) {
          setTimeout(function () { post(type, extra); }, 200);
          return;
        }
        window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({ type: type }, extra || {})));
      }

      function setStatus(text) {
        var el = document.getElementById('status');
        if (el) el.textContent = text;
      }

      function tryV2() {
        setStatus('Complete the checkbox below…');
        return fetch('https://identitytoolkit.googleapis.com/v1/recaptchaParams?key=' + encodeURIComponent(apiKey))
          .then(function (res) {
            return res.json().then(function (body) {
              return { ok: res.ok, status: res.status, body: body };
            });
          })
          .then(function (result) {
            if (!result.ok) {
              var msg = (result.body && result.body.error && result.body.error.message) || ('recaptchaParams HTTP ' + result.status);
              post('error', { message: msg });
              throw new Error(msg);
            }
            var siteKey = result.body.recaptchaSiteKey;

            return new Promise(function (resolve, reject) {
              window.__onRecaptchaLoad = function () { resolve(siteKey); };
              var script = document.createElement('script');
              script.src = 'https://www.google.com/recaptcha/api.js?onload=__onRecaptchaLoad&render=explicit';
              script.async = true;
              script.onerror = function () { reject(new Error('Failed to load grecaptcha script')); };
              document.head.appendChild(script);
            });
          })
          .then(function (siteKey) {
            grecaptcha.render(containerId, {
              sitekey: siteKey,
              size: size,
              callback: function (token) { post('verify', { token: token, tokenKind: 'v2' }); },
              'expired-callback': function () { post('expired'); },
              'error-callback': function () {
                post('error', { message: 'grecaptcha widget error' });
              },
            });
            post('load');
          });
      }

      function tryEnterprise(siteKey) {
        setStatus('Running security check…');
        return new Promise(function (resolve, reject) {
          window.__onEnterpriseLoad = function () {
            if (!window.grecaptcha || !window.grecaptcha.enterprise) {
              reject(new Error('grecaptcha.enterprise unavailable'));
              return;
            }
            window.grecaptcha.enterprise.ready(function () {
              window.grecaptcha.enterprise
                .execute(siteKey, { action: 'sendVerificationCode' })
                .then(function (token) {
                  post('verify', { token: token, tokenKind: 'enterprise' });
                  resolve(token);
                })
                .catch(reject);
            });
          };
          var script = document.createElement('script');
          script.src =
            'https://www.google.com/recaptcha/enterprise.js?render=' +
            encodeURIComponent(siteKey) +
            '&onload=__onEnterpriseLoad';
          script.async = true;
          script.onerror = function () { reject(new Error('Failed to load reCAPTCHA Enterprise script')); };
          document.head.appendChild(script);
        });
      }

      fetch(
        'https://identitytoolkit.googleapis.com/v2/recaptchaConfig?key=' +
          encodeURIComponent(apiKey) +
          '&clientType=CLIENT_TYPE_WEB&version=RECAPTCHA_ENTERPRISE'
      )
        .then(function (res) { return res.json(); })
        .then(function (config) {
          var phoneProvider = (config.recaptchaEnforcementState || []).find(function (entry) {
            return entry.provider === 'PHONE_PROVIDER';
          });
          var enforcement = phoneProvider ? phoneProvider.enforcementState : 'OFF';

          var useEnterprise =
            config.recaptchaKey &&
            (enforcement === 'ENFORCE' || enforcement === 'AUDIT');

          if (useEnterprise) {
            return tryEnterprise(config.recaptchaKey).catch(function () {
              return tryV2();
            });
          }
          return tryV2();
        })
        .catch(function () {
          return tryV2();
        })
        .catch(function (err) {
          post('error', {
            message: err && err.message ? err.message : 'reCAPTCHA init failed',
          });
        });

      window.addEventListener('message', function (event) {
        if (event.data && event.data.verify && window.grecaptcha) {
          try { window.grecaptcha.execute(); } catch (e) {}
        }
      });
    })();
  </script>
</body>
</html>`;
}

function getWebViewSource(invisible: boolean) {
  return {
    baseUrl: getRecaptchaWebViewBaseUrl(),
    html: buildRecaptchaHtml(invisible),
  };
}

export const FirebaseRecaptchaVerifierModal = forwardRef<
  FirebaseRecaptchaVerifierHandle,
  Props
>(function FirebaseRecaptchaVerifierModal(
  {
    attemptInvisibleVerification = false,
    title = 'Security check',
    cancelLabel = 'Cancel',
    onReadyChange,
    onSolvedChange,
  },
  ref,
) {
  const invisibleWebViewRef = useRef<WebView>(null);
  const visibleWebViewRef = useRef<WebView>(null);
  const resolveRef = useRef<((token: string) => void) | null>(null);
  const rejectRef = useRef<((error: Error) => void) | null>(null);
  const verifyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCaptchaMetaRef = useRef<NativeCaptchaMeta | null>(null);

  const clearVerifyTimeout = () => {
    if (verifyTimeoutRef.current) {
      clearTimeout(verifyTimeoutRef.current);
      verifyTimeoutRef.current = null;
    }
  };

  const [visible, setVisible] = useState(false);
  const [visibleLoaded, setVisibleLoaded] = useState(false);
  const [invisibleLoaded, setInvisibleLoaded] = useState(false);
  const [invisibleVerify, setInvisibleVerify] = useState(false);
  const [invisibleKey, setInvisibleKey] = useState(1);

  useImperativeHandle(ref, () => ({
    type: 'recaptcha' as const,
    verify: () =>
      new Promise<string>((resolve, reject) => {
        resolveRef.current = resolve;
        rejectRef.current = reject;
        clearVerifyTimeout();

        verifyTimeoutRef.current = setTimeout(() => {
          cancel('reCAPTCHA timed out — complete the checkbox and try again');
        }, RECAPTCHA_VERIFY_TIMEOUT_MS);

        if (attemptInvisibleVerification) {
          setInvisibleVerify(true);
        } else {
          setVisible(true);
          setVisibleLoaded(false);
        }
      }),
    _reset: () => {
      lastCaptchaMetaRef.current = null;
    },
    getLastCaptchaMeta: () => lastCaptchaMetaRef.current,
  }));

  const finish = (token: string) => {
    clearVerifyTimeout();
    resolveRef.current?.(token);
    resolveRef.current = null;
    rejectRef.current = null;
    setVisible(false);
    setInvisibleVerify(false);
    setInvisibleLoaded(false);
    setInvisibleKey((k) => k + 1);
  };

  const cancel = (reason = 'reCAPTCHA cancelled') => {
    clearVerifyTimeout();
    rejectRef.current?.(new Error(reason));
    resolveRef.current = null;
    rejectRef.current = null;
    setVisible(false);
    setInvisibleVerify(false);
  };

  const handleMessage =
    (invisible: boolean) =>
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          type: string;
          token?: string;
          tokenKind?: 'enterprise' | 'v2';
          message?: string;
        };

        switch (data.type) {
          case 'load':
            if (invisible) {
              setInvisibleLoaded(true);
            } else {
              setVisibleLoaded(true);
            }
            onReadyChange?.(true);
            break;
          case 'error':
            onReadyChange?.(false);
            if (invisible) {
              setInvisibleVerify(false);
              setVisible(true);
              break;
            }
            cancel(data.message ?? 'Failed to load reCAPTCHA');
            break;
          case 'expired':
            if (invisible) {
              setInvisibleVerify(false);
              setVisible(true);
            }
            break;
          case 'verify':
            if (data.token) {
              const tokenKind = data.tokenKind === 'enterprise' ? 'enterprise' : 'v2';
              lastCaptchaMetaRef.current = { tokenKind };
              onSolvedChange?.(true);
              finish(data.token);
            }
            break;
          default:
            break;
        }
      } catch {
        cancel('Invalid reCAPTCHA response');
      }
    };

  React.useEffect(() => {
    if (!invisibleVerify || !invisibleLoaded) return;
    invisibleWebViewRef.current?.injectJavaScript(`
      window.dispatchEvent(new MessageEvent('message', { data: { verify: true } }));
      true;
    `);
  }, [invisibleVerify, invisibleLoaded]);

  if (Platform.OS === 'web' || !env.firebase.configured) {
    return null;
  }

  return (
    <>
      {attemptInvisibleVerification ? (
        <View style={styles.hidden} key={`invisible-${invisibleKey}`} pointerEvents="none">
          <WebView
            ref={invisibleWebViewRef}
            source={getWebViewSource(true)}
            onMessage={handleMessage(true)}
            onError={() => cancel('Failed to load reCAPTCHA WebView')}
            {...WEBVIEW_PROPS}
          />
        </View>
      ) : null}

      <Modal visible={visible} animationType="slide" onRequestClose={() => cancel()}>
        <SafeAreaProvider>
          <SafeAreaView style={styles.modal} edges={['top', 'bottom']}>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => cancel()} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>{cancelLabel}</Text>
              </TouchableOpacity>
              <Text style={styles.title}>{title}</Text>
            </View>
            <Text style={styles.hint}>Complete the checkbox below, then return to the app.</Text>
            <View style={styles.content}>
              {!visibleLoaded ? (
                <View style={styles.loader}>
                  <ActivityIndicator size="large" color={colors.primary} />
                  <Text style={styles.loaderText}>Loading security check…</Text>
                </View>
              ) : null}
              <WebView
                ref={visibleWebViewRef}
                source={getWebViewSource(false)}
                onMessage={handleMessage(false)}
                onError={() => cancel('Failed to load reCAPTCHA WebView')}
                style={styles.webview}
                {...WEBVIEW_PROPS}
              />
            </View>
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>
    </>
  );
});

const styles = StyleSheet.create({
  hidden: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
    left: -9999,
    top: 0,
    overflow: 'hidden',
  },
  modal: { flex: 1, backgroundColor: colors.card },
  header: {
    height: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  cancelBtn: { position: 'absolute', left: 16 },
  cancelText: { ...textSize.base, fontFamily: fonts.sans.semibold, color: colors.primary },
  title: { ...textSize.base, fontFamily: fonts.heading.bold, color: colors.foreground },
  hint: {
    ...textSize.sm,
    fontFamily: fonts.sans.regular,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: colors.mutedForeground,
    textAlign: 'center',
  },
  content: { flex: 1, minHeight: 320 },
  webview: { flex: 1, minHeight: 320, backgroundColor: colors.card },
  loader: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
    zIndex: 1,
    backgroundColor: colors.card,
  },
  loaderText: { ...textSize.sm, fontFamily: fonts.sans.regular, color: colors.mutedForeground },
});
