#!/bin/bash
# Security Audit Script for Staff Review Application

echo "🔍 Starting Security Audit..."

# Check for common security issues
echo ""
echo "🔒 Checking for security misconfigurations..."

# Check if default JWT secret is still in use
if grep -r "change-this-to-a-secure-random-string-min-32-chars" . --exclude="*.md" --exclude="*.sh"; then
    echo "⚠️  WARNING: Default JWT secret detected in codebase!"
else
    echo "✅ No default JWT secret found in codebase"
fi

# Check for hardcoded passwords/credentials
echo ""
echo "🔑 Checking for hardcoded credentials..."
if grep -r "password.*=" . --exclude="*.md" --exclude="*.sh" --exclude-dir=node_modules --exclude-dir=.git; then
    echo "⚠️  Potential hardcoded credentials found - review carefully!"
else
    echo "✅ No obvious hardcoded credentials found"
fi

# Check for insecure development flags
echo ""
echo "🛡️  Checking for insecure development configurations..."
if grep -r "insecure_dev_mode" . --exclude="*.md" --exclude-dir=node_modules --exclude-dir=.git; then
    echo "❌ CRITICAL: insecure_dev_mode found in configuration!"
else
    echo "✅ No insecure development modes found"
fi

# Check for http origins in production config
echo ""
echo "🌐 Checking for insecure HTTP origins..."
if grep -r "http://" . --include="*.env*" --exclude-dir=node_modules --exclude-dir=.git | grep -v "localhost\|127.0.0.1"; then
    echo "⚠️  HTTP origins found in config (should use HTTPS in production)"
else
    echo "✅ No non-localhost HTTP origins found in config"
fi

# Check for debug/verbose logging in production
echo ""
echo "📝 Checking for verbose logging configurations..."
if grep -r "debug\|verbose" . --include="*.env*" --include="*.js" --include="*.ts" --exclude-dir=node_modules --exclude-dir=.git | grep -i "prod"; then
    echo "⚠️  Verbose logging found in production configs"
else
    echo "✅ No verbose logging in production configs found"
fi

# Check for missing security headers
echo ""
echo "🛡️  Checking for security headers implementation..."
if grep -r "secureHeaders\|helmet\|security" server/src/server.ts; then
    echo "✅ Security headers implementation found"
else
    echo "⚠️  Security headers may be missing"
fi

# Check for proper CORS configuration
echo ""
echo "🌐 Checking CORS configuration..."
if grep -r "ALLOWED_ORIGINS\|cors" server/src/server.ts; then
    echo "✅ CORS configuration found"
else
    echo "⚠️  CORS configuration may be missing"
fi

# Check for input validation
echo ""
echo "✅ Checking for input validation..."
if grep -r "zValidator\|zod\|validation" server/src/; then
    echo "✅ Input validation with Zod found"
else
    echo "⚠️  Input validation may be missing"
fi

echo ""
echo "📋 Audit Complete!"
echo ""
echo "💡 Recommendations:"
echo "   1. Ensure JWT_SECRET is set to a strong random value in production"
echo "   2. Use HTTPS for all production environments"
echo "   3. Regularly update dependencies to patch security vulnerabilities"
echo "   4. Implement rate limiting for authentication endpoints"
echo "   5. Add security monitoring and alerting"