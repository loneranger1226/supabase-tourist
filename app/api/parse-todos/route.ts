import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// 初始化OpenAI客户端
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
});

// 初始化Supabase客户端（使用服务端角色密钥）
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { text, userId } = await request.json();

    if (!text || !userId) {
      return NextResponse.json(
        { error: '文本和用户ID是必需的' },
        { status: 400 }
      );
    }

    // 调用OpenAI API解析待办事项
    const completion = await openai.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: `你是一个智能待办事项解析助手。请根据用户输入的文本，解析出具体的待办事项。

要求：
1. 将用户的描述解析成具体的、可执行的待办事项
2. 每个待办事项应该是简洁明了的任务描述
3. 如果用户描述中包含多个任务，请分别列出
4. 如果用户描述模糊，请根据上下文推断出合理的任务
5. 返回格式为JSON数组，每个元素是一个待办事项对象，包含text字段

示例：
用户输入："明天要开会，还要买咖啡，记得给妈妈打电话"
输出：[{"text": "准备明天的会议"}, {"text": "买咖啡"}, {"text": "给妈妈打电话"}]`
        },
        {
          role: 'user',
          content: text
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
    });

    const aiResponse = completion.choices[0]?.message?.content;
    if (!aiResponse) {
      throw new Error('AI响应为空');
    }

    // 添加调试日志
    console.log('AI原始响应:', aiResponse);

    // 解析AI返回的JSON
    let todos;
    try {
      // 首先尝试直接解析JSON
      todos = JSON.parse(aiResponse);
    } catch (parseError) {
      // 如果直接解析失败，尝试提取```json代码块中的内容
      const jsonMatch = aiResponse.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        try {
          todos = JSON.parse(jsonMatch[1]);
        } catch (nestedParseError) {
          // 如果代码块解析也失败，尝试提取文本内容
          const lines = aiResponse.split('\n').filter(line => line.trim());
          todos = lines.map(line => ({ text: line.trim() }));
        }
      } else {
        // 如果没有找到代码块，尝试提取文本内容
        const lines = aiResponse.split('\n').filter(line => line.trim());
        todos = lines.map(line => ({ text: line.trim() }));
      }
    }

    if (!Array.isArray(todos) || todos.length === 0) {
      return NextResponse.json(
        { error: '无法解析出有效的待办事项' },
        { status: 400 }
      );
    }

    // 过滤和验证待办事项，只保留有效的text字段
    const validTodos = todos
      .filter(todo => todo && typeof todo === 'object' && todo.text && typeof todo.text === 'string')
      .map(todo => ({
        text: todo.text.trim(),
        user_id: userId,
        completed: false,
      }))
      .filter(todo => todo.text.length > 0);

    // 添加调试日志
    console.log('解析后的待办事项:', validTodos);

    if (validTodos.length === 0) {
      return NextResponse.json(
        { error: '没有找到有效的待办事项文本' },
        { status: 400 }
      );
    }

    // 批量插入到数据库
    const { data, error } = await supabase
      .from('todos')
      .insert(validTodos)
      .select('id, text, completed, image_url');

    if (error) {
      console.error('数据库插入错误:', error);
      return NextResponse.json(
        { error: '保存待办事项失败' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      todos: data,
      count: data.length
    });

  } catch (error) {
    console.error('API错误:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
