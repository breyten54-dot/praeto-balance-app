import Constants from 'expo-constants';

export type AppEnvName = 'development' | 'staging' | 'production';

type FeatureFlags = {
  balanceSave: boolean;
  riskProfileModule: boolean;
  rewardsMarketplace: boolean;
  coachingBooking: boolean;
};

export type AppEnv = {
  appEnv: AppEnvName;
  apiBaseUrl: string;
  apiTimeoutMs: number;
  revenueCatApiKeyIos: string;
  revenueCatApiKeyAndroid: string;
  payfastMerchantId: string;
  payfastReturnUrlBase: string;
  sentryDsn: string;
  enableDebugMenu: boolean;
  features: FeatureFlags;
};

const configs: Record<AppEnvName, AppEnv> = {
  development: {
    appEnv: 'development',
    apiBaseUrl: 'http://localhost:4000/api/v1',
    apiTimeoutMs: 15_000,
    revenueCatApiKeyIos: 'appl_DEV_PLACEHOLDER',
    revenueCatApiKeyAndroid: 'goog_DEV_PLACEHOLDER',
    payfastMerchantId: 'PAYFAST_SANDBOX_MERCHANT_ID',
    payfastReturnUrlBase: 'https://staging.praetobalance.co.za/payments',
    sentryDsn: '',
    enableDebugMenu: true,
    features: {
      balanceSave: true,
      riskProfileModule: true,
      rewardsMarketplace: true,
      coachingBooking: true,
    },
  },
  staging: {
    appEnv: 'staging',
    apiBaseUrl: 'https://praeto-balance-api-v7pz.onrender.com/api/v1',
    apiTimeoutMs: 75_000,
    revenueCatApiKeyIos: 'appl_STAGING_PLACEHOLDER',
    revenueCatApiKeyAndroid: 'goog_STAGING_PLACEHOLDER',
    payfastMerchantId: 'PAYFAST_SANDBOX_MERCHANT_ID',
    payfastReturnUrlBase: 'https://staging.praetobalance.co.za/payments',
    sentryDsn: 'REPLACE_WITH_SENTRY_DSN',
    enableDebugMenu: true,
    features: {
      balanceSave: true,
      riskProfileModule: true,
      rewardsMarketplace: true,
      coachingBooking: true,
    },
  },
  production: {
    appEnv: 'production',
    apiBaseUrl: 'https://api.praetobalance.co.za/api/v1',
    apiTimeoutMs: 15_000,
    revenueCatApiKeyIos: 'appl_PRODUCTION_PLACEHOLDER',
    revenueCatApiKeyAndroid: 'goog_PRODUCTION_PLACEHOLDER',
    payfastMerchantId: 'PAYFAST_LIVE_MERCHANT_ID',
    payfastReturnUrlBase: 'https://praetobalance.co.za/payments',
    sentryDsn: 'REPLACE_WITH_SENTRY_DSN',
    enableDebugMenu: false,
    features: {
      balanceSave: false,
      riskProfileModule: false,
      rewardsMarketplace: true,
      coachingBooking: true,
    },
  },
};

const baked =
  (Constants.expoConfig?.extra as { appEnv?: AppEnvName } | undefined)?.appEnv ??
  (process.env.APP_ENV as AppEnvName | undefined) ??
  'development';

export const env: AppEnv = configs[baked] ?? configs.development;
