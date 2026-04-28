'use client';

import { useState, useEffect } from 'react';
import { Bot, Send, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

const questions = [
  'What are your pricing plans?',
  'How do I embed the chatbot?',
  'Can I customize the appearance?',
];

const answers = [
  'We have Free, Starter, and Pro plans! You can see details on our pricing section.',
  'Just copy a single line of code from your dashboard and paste it into your website.',
  'Yes! You can customize the bot persona, icon, colors, and theme to match your brand.',
];

export function MockChatWidget() {
  const [messages, setMessages] = useState([
    {
      from: 'bot',
      text: 'Hello! How can I help you today?',
    },
  ]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const chatLoop = setInterval(() => {
      setMessages((prev) => [
        ...prev,
        { from: 'user', text: questions[currentIndex] },
      ]);
      setIsTyping(true);
      
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { from: 'bot', text: answers[currentIndex] },
        ]);
        setIsTyping(false);
        setCurrentIndex((prev) => (prev + 1) % questions.length);
      }, 1500 + Math.random() * 500);

    }, 5000);

    return () => clearInterval(chatLoop);
  }, [currentIndex]);

  return (
    <Card className="w-full max-w-sm shadow-2xl shadow-primary/20 bg-card/80 backdrop-blur-sm">
      <div className="bg-primary/10 p-3 flex items-center gap-3 border-b">
        <div className="bg-primary text-primary-foreground p-2 rounded-full">
          <Bot className="w-5 h-5" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Nocta Assistant</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
             <span className="w-2 h-2 rounded-full bg-green-500"></span>
             Online
          </p>
        </div>
      </div>
      <div className="h-72 p-4 overflow-y-auto flex flex-col gap-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn(
              'flex items-end gap-2 max-w-[85%]',
              msg.from === 'user' ? 'self-end' : 'self-start'
            )}
          >
            {msg.from === 'bot' && (
              <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
            )}
            <div
              className={cn(
                'rounded-lg px-3 py-2',
                msg.from === 'user'
                  ? 'bg-accent text-accent-foreground'
                  : 'bg-secondary'
              )}
            >
              <p className="text-sm">{msg.text}</p>
            </div>
          </div>
        ))}
         {isTyping && (
          <div className="flex items-end gap-2 max-w-[85%] self-start">
            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-secondary rounded-lg px-3 py-2">
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-0"></span>
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-150"></span>
                <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce delay-300"></span>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="p-3 border-t flex items-center gap-2">
        <input
          type="text"
          placeholder="Ask a question..."
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          disabled
        />
        <button className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-accent text-accent-foreground hover:bg-accent/90 h-10 w-10">
          <Send className="h-4 w-4" />
        </button>
      </div>
    </Card>
  );
}
