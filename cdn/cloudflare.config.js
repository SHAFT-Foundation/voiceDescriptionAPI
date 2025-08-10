/**
 * Cloudflare CDN Configuration for Voice Description API
 * Optimizes content delivery and caching strategies
 */

// Cloudflare Worker Script for Edge Optimization
export const cloudflareWorkerScript = `
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);
  
  // Cache configuration based on path
  const cacheConfig = getCacheConfig(url.pathname);
  
  // Check cache first
  const cache = caches.default;
  let response = await cache.match(request);
  
  if (!response) {
    // Forward request to origin
    response = await fetch(request, {
      cf: {
        // Cloudflare features
        cacheTtl: cacheConfig.ttl,
        cacheEverything: cacheConfig.cacheEverything,
        minify: {
          javascript: true,
          css: true,
          html: true
        },
        mirage: true,
        polish: 'lossless',
        scrapeShield: true,
        apps: false
      }
    });
    
    // Add custom headers
    response = new Response(response.body, response);
    response.headers.set('X-CDN', 'Cloudflare');
    response.headers.set('X-Cache-Status', 'MISS');
    
    // Store in cache if applicable
    if (response.ok && cacheConfig.shouldCache) {
      event.waitUntil(cache.put(request, response.clone()));
    }
  } else {
    // Add cache hit header
    response = new Response(response.body, response);
    response.headers.set('X-Cache-Status', 'HIT');
  }
  
  // Add security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  return response;
}

function getCacheConfig(pathname) {
  // Static assets - long cache
  if (pathname.match(/\.(js|css|jpg|jpeg|png|gif|svg|woff|woff2|ttf|eot)$/)) {
    return {
      ttl: 31536000, // 1 year
      cacheEverything: true,
      shouldCache: true
    };
  }
  
  // API responses - short cache
  if (pathname.startsWith('/api/')) {
    // Don't cache POST requests or sensitive endpoints
    if (pathname.includes('upload') || pathname.includes('process')) {
      return {
        ttl: 0,
        cacheEverything: false,
        shouldCache: false
      };
    }
    
    // Cache GET requests briefly
    return {
      ttl: 60, // 1 minute
      cacheEverything: false,
      shouldCache: true
    };
  }
  
  // HTML pages - medium cache
  return {
    ttl: 3600, // 1 hour
    cacheEverything: true,
    shouldCache: true
  };
}
`;

// Cloudflare Page Rules Configuration
export const pageRules = [
  {
    target: 'https://voice-description-api.onrender.com/api/*',
    actions: {
      cache_level: 'bypass',
      security_level: 'high',
      ssl: 'full_strict',
      always_use_https: true,
      browser_cache_ttl: 0
    }
  },
  {
    target: 'https://voice-description-api.onrender.com/static/*',
    actions: {
      cache_level: 'everything',
      edge_cache_ttl: 31536000,
      browser_cache_ttl: 31536000,
      polish: 'lossless',
      minify: {
        js: true,
        css: true,
        html: true
      }
    }
  },
  {
    target: 'https://voice-description-api.onrender.com/_next/static/*',
    actions: {
      cache_level: 'everything',
      edge_cache_ttl: 31536000,
      browser_cache_ttl: 31536000,
      polish: 'lossless'
    }
  },
  {
    target: 'https://voice-description-api.onrender.com/images/*',
    actions: {
      cache_level: 'everything',
      edge_cache_ttl: 2592000,
      browser_cache_ttl: 2592000,
      polish: 'lossless',
      webp: true,
      mirage: true
    }
  }
];

// Cloudflare Transform Rules
export const transformRules = {
  // URL Rewrite Rules
  urlRewrite: [
    {
      description: 'Remove trailing slashes',
      expression: '(http.request.uri.path matches "^/.+/$")',
      action: 'rewrite',
      value: 'regex_replace(http.request.uri.path, "/$", "")'
    },
    {
      description: 'Normalize API paths',
      expression: '(http.request.uri.path matches "^/api/v[0-9]+/")',
      action: 'rewrite',
      value: 'regex_replace(http.request.uri.path, "^/api/v[0-9]+/", "/api/")'
    }
  ],
  
  // HTTP Request Header Modification
  requestHeaders: [
    {
      description: 'Add CDN tracking header',
      action: 'set',
      header: 'X-CDN-Request-ID',
      value: 'generate_uuid()'
    },
    {
      description: 'Add geo location',
      action: 'set',
      header: 'CF-IPCountry',
      value: 'ip.geoip.country'
    }
  ],
  
  // HTTP Response Header Modification
  responseHeaders: [
    {
      description: 'Add cache control for static assets',
      expression: '(http.request.uri.path matches "\.(js|css|jpg|png|gif|svg)$")',
      action: 'set',
      header: 'Cache-Control',
      value: 'public, max-age=31536000, immutable'
    },
    {
      description: 'Add security headers',
      action: 'set',
      headers: {
        'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy': "default-src 'self'"
      }
    }
  ]
};

// Cloudflare Firewall Rules
export const firewallRules = [
  {
    description: 'Block known bad IPs',
    expression: '(ip.src in {1.2.3.4 5.6.7.8})',
    action: 'block'
  },
  {
    description: 'Challenge suspicious requests',
    expression: '(cf.threat_score > 30)',
    action: 'challenge'
  },
  {
    description: 'Rate limit API endpoints',
    expression: '(http.request.uri.path matches "^/api/" and rate_limit.exceeded)',
    action: 'block',
    rateLimit: {
      threshold: 100,
      period: 60
    }
  },
  {
    description: 'Block non-GET requests to static assets',
    expression: '(http.request.method ne "GET" and http.request.uri.path matches "\.(js|css|jpg|png)$")',
    action: 'block'
  },
  {
    description: 'Allow only specific countries (optional)',
    expression: '(ip.geoip.country ne "US" and ip.geoip.country ne "CA" and ip.geoip.country ne "GB")',
    action: 'challenge',
    enabled: false
  }
];

// Cloudflare Cache Rules
export const cacheRules = {
  // Cache Key Configuration
  cacheKey: {
    includeQueryString: ['page', 'limit', 'sort'],
    excludeQueryString: ['utm_source', 'utm_medium', 'utm_campaign'],
    includeHeaders: ['Accept-Language'],
    includeCookie: false
  },
  
  // Cache TTL by Content Type
  ttlByContentType: {
    'text/html': 3600,           // 1 hour
    'application/json': 60,       // 1 minute
    'text/css': 31536000,        // 1 year
    'application/javascript': 31536000, // 1 year
    'image/*': 2592000,          // 30 days
    'video/*': 86400,            // 1 day
    'font/*': 31536000           // 1 year
  },
  
  // Cache Purge Patterns
  purgePatterns: [
    '/api/cache/purge',
    '/_next/static/*',
    '/static/*'
  ]
};

// Cloudflare Analytics Configuration
export const analyticsConfig = {
  // Web Analytics
  webAnalytics: {
    siteTag: 'voice-description-api',
    enabled: true
  },
  
  // Custom Analytics Rules
  customMetrics: [
    {
      name: 'api_requests',
      filter: 'http.request.uri.path matches "^/api/"'
    },
    {
      name: 'video_processing',
      filter: 'http.request.uri.path eq "/api/process"'
    },
    {
      name: 'image_processing',
      filter: 'http.request.uri.path eq "/api/process-image"'
    }
  ]
};

// Cloudflare Load Balancing Configuration
export const loadBalancing = {
  pools: [
    {
      name: 'primary-pool',
      origins: [
        {
          name: 'render-primary',
          address: 'voice-description-api.onrender.com',
          enabled: true,
          weight: 1,
          header: {
            Host: ['voice-description-api.onrender.com']
          }
        }
      ],
      check_regions: ['WNAM', 'ENAM'],
      minimum_origins: 1,
      monitor: '/api/health'
    }
  ],
  
  loadBalancer: {
    name: 'voice-description-lb',
    default_pools: ['primary-pool'],
    fallback_pool: 'primary-pool',
    proxied: true,
    steering_policy: 'off',
    session_affinity: 'cookie',
    session_affinity_ttl: 3600
  }
};

// Cloudflare DDoS Protection Settings
export const ddosProtection = {
  // Network-layer DDoS Protection
  networkDDoS: {
    sensitivity: 'high',
    action: 'challenge'
  },
  
  // HTTP DDoS Protection
  httpDDoS: {
    sensitivity: 'high',
    action: 'block',
    rules: [
      {
        description: 'Block excessive requests',
        threshold: 1000,
        period: 60,
        action: 'block'
      },
      {
        description: 'Challenge suspicious patterns',
        threshold: 100,
        period: 10,
        action: 'challenge'
      }
    ]
  }
};

// Cloudflare API Configuration Script
export const cloudflareAPIScript = `
#!/bin/bash

# Cloudflare API Configuration Script
# Set your Cloudflare credentials
CF_EMAIL="your-email@example.com"
CF_API_KEY="your-api-key"
CF_ZONE_ID="your-zone-id"

# API endpoint
CF_API="https://api.cloudflare.com/client/v4"

# Create Page Rules
echo "Creating page rules..."
curl -X POST "$CF_API/zones/$CF_ZONE_ID/pagerules" \\
  -H "X-Auth-Email: $CF_EMAIL" \\
  -H "X-Auth-Key: $CF_API_KEY" \\
  -H "Content-Type: application/json" \\
  --data '{
    "targets": [{"target": "url", "constraint": {"operator": "matches", "value": "voice-description-api.onrender.com/api/*"}}],
    "actions": [{"id": "cache_level", "value": "bypass"}],
    "priority": 1,
    "status": "active"
  }'

# Configure Firewall Rules
echo "Configuring firewall rules..."
curl -X POST "$CF_API/zones/$CF_ZONE_ID/firewall/rules" \\
  -H "X-Auth-Email: $CF_EMAIL" \\
  -H "X-Auth-Key: $CF_API_KEY" \\
  -H "Content-Type: application/json" \\
  --data '{
    "filter": {"expression": "(cf.threat_score > 30)"},
    "action": "challenge",
    "description": "Challenge high threat score"
  }'

# Enable Web Analytics
echo "Enabling web analytics..."
curl -X PUT "$CF_API/zones/$CF_ZONE_ID/analytics/web" \\
  -H "X-Auth-Email: $CF_EMAIL" \\
  -H "X-Auth-Key: $CF_API_KEY" \\
  -H "Content-Type: application/json" \\
  --data '{"enabled": true}'

# Configure Cache Settings
echo "Configuring cache settings..."
curl -X PATCH "$CF_API/zones/$CF_ZONE_ID/settings/cache_level" \\
  -H "X-Auth-Email: $CF_EMAIL" \\
  -H "X-Auth-Key: $CF_API_KEY" \\
  -H "Content-Type: application/json" \\
  --data '{"value": "aggressive"}'

# Enable Auto Minify
echo "Enabling auto minify..."
curl -X PATCH "$CF_API/zones/$CF_ZONE_ID/settings/minify" \\
  -H "X-Auth-Email: $CF_EMAIL" \\
  -H "X-Auth-Key: $CF_API_KEY" \\
  -H "Content-Type: application/json" \\
  --data '{"value": {"css": true, "html": true, "js": true}}'

# Enable Brotli Compression
echo "Enabling Brotli compression..."
curl -X PATCH "$CF_API/zones/$CF_ZONE_ID/settings/brotli" \\
  -H "X-Auth-Email: $CF_EMAIL" \\
  -H "X-Auth-Key: $CF_API_KEY" \\
  -H "Content-Type: application/json" \\
  --data '{"value": "on"}'

echo "Cloudflare configuration complete!"
`;

// Export configuration
export default {
  cloudflareWorkerScript,
  pageRules,
  transformRules,
  firewallRules,
  cacheRules,
  analyticsConfig,
  loadBalancing,
  ddosProtection,
  cloudflareAPIScript
};