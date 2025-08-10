import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Check, X, Zap, Shield, Globe, Users, 
  TrendingUp, HeadphonesIcon, Award, ArrowRight,
  Sparkles, Building2, Rocket, Info
} from 'lucide-react';

interface PricingPlan {
  name: string;
  price: string;
  period: string;
  description: string;
  featured: boolean;
  features: Array<{ text: string; included: boolean }>;
  limits: {
    videos?: string;
    images?: string;
    minutes?: string;
    storage?: string;
  };
  cta: string;
  gradient: string;
}

export const PricingSection: React.FC = () => {
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly');

  const plans: PricingPlan[] = [
    {
      name: 'Starter',
      price: billingPeriod === 'monthly' ? '$29' : '$290',
      period: billingPeriod === 'monthly' ? '/month' : '/year',
      description: 'Perfect for individuals and small projects',
      featured: false,
      gradient: 'from-gray-600 to-gray-800',
      features: [
        { text: '100 video minutes/month', included: true },
        { text: '500 images/month', included: true },
        { text: 'Standard quality audio', included: true },
        { text: '5 languages', included: true },
        { text: 'Email support', included: true },
        { text: 'API access', included: true },
        { text: 'Custom voices', included: false },
        { text: 'Priority processing', included: false },
        { text: 'Team collaboration', included: false },
      ],
      limits: {
        videos: '100 min',
        images: '500',
        storage: '10 GB',
      },
      cta: 'Start Free Trial',
    },
    {
      name: 'Professional',
      price: billingPeriod === 'monthly' ? '$99' : '$990',
      period: billingPeriod === 'monthly' ? '/month' : '/year',
      description: 'Ideal for businesses and content creators',
      featured: true,
      gradient: 'from-purple-600 to-blue-600',
      features: [
        { text: '500 video minutes/month', included: true },
        { text: '2,500 images/month', included: true },
        { text: 'HD quality audio', included: true },
        { text: '30+ languages', included: true },
        { text: 'Priority support', included: true },
        { text: 'Advanced API access', included: true },
        { text: 'Custom voices', included: true },
        { text: 'Priority processing', included: true },
        { text: 'Team collaboration', included: false },
      ],
      limits: {
        videos: '500 min',
        images: '2,500',
        storage: '50 GB',
      },
      cta: 'Start Free Trial',
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: '',
      description: 'Tailored solutions for large organizations',
      featured: false,
      gradient: 'from-indigo-600 to-purple-600',
      features: [
        { text: 'Unlimited processing', included: true },
        { text: 'Unlimited images', included: true },
        { text: 'Ultra HD audio quality', included: true },
        { text: 'All languages', included: true },
        { text: 'Dedicated support', included: true },
        { text: 'Custom API endpoints', included: true },
        { text: 'Custom voice training', included: true },
        { text: 'Instant processing', included: true },
        { text: 'Unlimited team members', included: true },
      ],
      limits: {
        videos: 'Unlimited',
        images: 'Unlimited',
        storage: 'Unlimited',
      },
      cta: 'Contact Sales',
    },
  ];

  return (
    <section id="pricing" className="py-20 bg-gradient-to-br from-gray-50 to-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <span className="px-4 py-2 bg-purple-100 text-purple-700 text-sm font-semibold rounded-full inline-flex items-center gap-2 mb-4">
            <Sparkles className="w-4 h-4" />
            Flexible Pricing
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
            Choose Your Perfect Plan
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Start with a 14-day free trial. No credit card required. 
            Scale as you grow with transparent, usage-based pricing.
          </p>

          {/* Billing Toggle */}
          <div className="inline-flex items-center gap-4 bg-gray-100 rounded-xl p-2">
            <button
              onClick={() => setBillingPeriod('monthly')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                billingPeriod === 'monthly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingPeriod('yearly')}
              className={`px-4 py-2 rounded-lg font-semibold transition-all ${
                billingPeriod === 'yearly'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600'
              }`}
            >
              Yearly
              <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
                Save 20%
              </span>
            </button>
          </div>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          {plans.map((plan, index) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className={`relative ${plan.featured ? 'scale-105' : ''}`}
            >
              {plan.featured && (
                <div className="absolute -top-5 left-0 right-0 flex justify-center">
                  <span className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm font-semibold rounded-full shadow-lg">
                    Most Popular
                  </span>
                </div>
              )}

              <div className={`h-full bg-white rounded-2xl shadow-xl overflow-hidden ${
                plan.featured ? 'ring-2 ring-purple-600' : ''
              }`}>
                {/* Plan Header */}
                <div className={`bg-gradient-to-r ${plan.gradient} p-8 text-white`}>
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-white/90 mb-4">{plan.description}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-bold">{plan.price}</span>
                    <span className="text-white/80">{plan.period}</span>
                  </div>
                </div>

                {/* Plan Features */}
                <div className="p-8">
                  {/* Limits */}
                  <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{plan.limits.videos}</p>
                      <p className="text-xs text-gray-600">Video</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{plan.limits.images}</p>
                      <p className="text-xs text-gray-600">Images</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-gray-900">{plan.limits.storage}</p>
                      <p className="text-xs text-gray-600">Storage</p>
                    </div>
                  </div>

                  {/* Features List */}
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature) => (
                      <li
                        key={feature.text}
                        className="flex items-start gap-3"
                      >
                        {feature.included ? (
                          <Check className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <X className="w-5 h-5 text-gray-300 flex-shrink-0 mt-0.5" />
                        )}
                        <span className={`text-sm ${
                          feature.included ? 'text-gray-700' : 'text-gray-400'
                        }`}>
                          {feature.text}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA Button */}
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    className={`w-full py-3 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 ${
                      plan.featured
                        ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg hover:shadow-xl'
                        : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                    }`}
                  >
                    {plan.cta}
                    <ArrowRight className="w-5 h-5" />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Additional Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-8"
        >
          <h3 className="text-2xl font-bold text-gray-900 mb-6 text-center">
            All Plans Include
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Shield, title: 'Enterprise Security', desc: 'SSL, encryption, GDPR compliant' },
              { icon: Globe, title: 'Global CDN', desc: 'Fast delivery worldwide' },
              { icon: TrendingUp, title: 'Analytics Dashboard', desc: 'Track usage and performance' },
              { icon: Users, title: 'Developer Support', desc: 'Documentation and SDKs' },
            ].map((item) => (
              <div key={item.title} className="text-center">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mx-auto mb-3 shadow-sm">
                  <item.icon className="w-6 h-6 text-purple-600" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">{item.title}</h4>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* FAQ Link */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mt-12"
        >
          <p className="text-gray-600 mb-4">
            Questions about pricing? Check our detailed FAQ or contact sales.
          </p>
          <div className="flex justify-center gap-4">
            <a
              href="#"
              className="px-6 py-3 bg-white text-gray-700 font-semibold rounded-xl shadow-md hover:shadow-lg transition-all border border-gray-200"
            >
              View FAQ
            </a>
            <a
              href="#"
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all"
            >
              Contact Sales
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
};