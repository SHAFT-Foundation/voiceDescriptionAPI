import React from 'react';
import { motion } from 'framer-motion';
import { 
  Brain, Zap, Shield, Globe, Users, BarChart3,
  Video, Image, Mic, FileText, Clock, CheckCircle,
  ArrowRight, Star, TrendingUp, Award
} from 'lucide-react';

interface Feature {
  icon: React.ComponentType<any>;
  title: string;
  description: string;
  color: string;
  stats?: string;
}

interface UseCase {
  title: string;
  description: string;
  image?: string;
  benefits: string[];
}

interface Testimonial {
  quote: string;
  author: string;
  role: string;
  company: string;
  rating: number;
}

export const FeaturesShowcase: React.FC = () => {
  const features: Feature[] = [
    {
      icon: Brain,
      title: 'AI-Powered Analysis',
      description: 'Advanced neural networks understand context, emotions, and visual nuances',
      color: 'from-purple-500 to-pink-500',
      stats: '99.9% accuracy',
    },
    {
      icon: Zap,
      title: 'Lightning Fast',
      description: 'Process hours of video content in minutes with parallel processing',
      color: 'from-yellow-500 to-orange-500',
      stats: '10x faster',
    },
    {
      icon: Shield,
      title: 'Enterprise Security',
      description: 'Bank-level encryption and compliance with accessibility standards',
      color: 'from-green-500 to-teal-500',
      stats: 'SOC 2 compliant',
    },
    {
      icon: Globe,
      title: 'Multi-Language',
      description: 'Support for 30+ languages with native speaker quality',
      color: 'from-blue-500 to-cyan-500',
      stats: '30+ languages',
    },
    {
      icon: Users,
      title: 'Scalable API',
      description: 'Handle millions of requests with auto-scaling infrastructure',
      color: 'from-indigo-500 to-purple-500',
      stats: '99.99% uptime',
    },
    {
      icon: BarChart3,
      title: 'Analytics Dashboard',
      description: 'Track usage, performance, and accessibility metrics in real-time',
      color: 'from-red-500 to-pink-500',
      stats: 'Real-time insights',
    },
  ];

  const useCases: UseCase[] = [
    {
      title: 'Educational Content',
      description: 'Make online courses and educational videos accessible to all learners',
      benefits: [
        'Improve learning outcomes',
        'Meet accessibility requirements',
        'Expand audience reach',
      ],
    },
    {
      title: 'Media & Entertainment',
      description: 'Add audio descriptions to movies, TV shows, and streaming content',
      benefits: [
        'Comply with FCC regulations',
        'Enhance viewer experience',
        'Increase content value',
      ],
    },
    {
      title: 'Corporate Training',
      description: 'Ensure all employees can access training materials regardless of abilities',
      benefits: [
        'Foster inclusive workplace',
        'Meet compliance standards',
        'Improve retention rates',
      ],
    },
    {
      title: 'Social Media',
      description: 'Automatically generate alt text and descriptions for social content',
      benefits: [
        'Boost engagement',
        'Improve SEO ranking',
        'Build inclusive brand',
      ],
    },
  ];

  const testimonials: Testimonial[] = [
    {
      quote: "This API transformed how we deliver accessible content. Implementation was seamless and the results are incredible.",
      author: "Sarah Chen",
      role: "Head of Accessibility",
      company: "TechEdu Platform",
      rating: 5,
    },
    {
      quote: "The accuracy and speed are game-changing. We've made our entire video library accessible in just weeks.",
      author: "Michael Rodriguez",
      role: "CTO",
      company: "StreamVision Media",
      rating: 5,
    },
    {
      quote: "Finally, an accessibility solution that actually understands context and delivers natural-sounding descriptions.",
      author: "Emily Thompson",
      role: "Product Manager",
      company: "Global Learning Inc",
      rating: 5,
    },
  ];

  return (
    <div className="space-y-20 py-20">
      {/* Features Grid */}
      <section className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Powerful Features for Every Need
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Built with cutting-edge AI technology and designed for developers, 
            our API provides everything you need to create accessible content at scale.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              whileHover={{ scale: 1.05 }}
              className="bg-white rounded-xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all"
            >
              <div className={`w-14 h-14 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center mb-4`}>
                <feature.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                {feature.title}
              </h3>
              <p className="text-gray-600 mb-3">
                {feature.description}
              </p>
              {feature.stats && (
                <div className="flex items-center gap-2 text-sm">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                  <span className="font-semibold text-gray-900">{feature.stats}</span>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </section>

      {/* Use Cases */}
      <section className="bg-gradient-to-br from-gray-50 to-white py-20">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Use Cases Across Industries
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              From education to entertainment, our API serves diverse industries 
              with tailored solutions for accessibility.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {useCases.map((useCase, index) => (
              <motion.div
                key={useCase.title}
                initial={{ opacity: 0, x: index % 2 === 0 ? -20 : 20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="bg-white rounded-xl shadow-md p-8 border border-gray-100"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Award className="w-6 h-6 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-semibold text-gray-900 mb-2">
                      {useCase.title}
                    </h3>
                    <p className="text-gray-600 mb-4">
                      {useCase.description}
                    </p>
                    <ul className="space-y-2">
                      {useCase.benefits.map((benefit) => (
                        <li key={benefit} className="flex items-center gap-2 text-sm text-gray-700">
                          <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                          {benefit}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="max-w-7xl mx-auto px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            Trusted by Industry Leaders
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            See what our customers are saying about their experience with our API.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.author}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="bg-white rounded-xl shadow-lg p-6 border border-gray-100"
            >
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>
              <blockquote className="text-gray-700 mb-6 italic">
                "{testimonial.quote}"
              </blockquote>
              <div className="border-t pt-4">
                <p className="font-semibold text-gray-900">{testimonial.author}</p>
                <p className="text-sm text-gray-600">
                  {testimonial.role}, {testimonial.company}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mx-4 lg:mx-auto max-w-7xl p-12 text-white text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl font-bold mb-4">
            Ready to Make Your Content Accessible?
          </h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Start your free trial today and see the difference AI-powered 
            accessibility can make for your audience.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 bg-white text-blue-600 font-semibold rounded-lg shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              Start Free Trial
              <ArrowRight className="w-5 h-5" />
            </motion.button>
            <motion.a
              href="/docs"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-4 bg-white/20 backdrop-blur text-white font-semibold rounded-lg border border-white/30 hover:bg-white/30 transition-all flex items-center justify-center gap-2"
            >
              View Documentation
            </motion.a>
          </div>
        </motion.div>
      </section>
    </div>
  );
};