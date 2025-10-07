"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Check, Circle, Plus, Trash2, Pencil, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Todo = {
  id: number;
  text: string;
  completed: boolean;
  user_id?: string;
  image_url?: string | null;
};

export default function Home() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [newTodo, setNewTodo] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let isMounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!isMounted) return;
      setIsAuthenticated(!!data.user);
      setUserId(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session?.user);
      setUserId(session?.user?.id ?? null);
    });
    return () => {
      isMounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const supabase = createClient();
    if (!userId) {
      setTodos([]);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const { data, error } = await supabase
        .from("todos")
        .select("id, text, completed, image_url")
        .order("created_at", { ascending: false });
      if (error) return;
      if (!cancelled) setTodos(data as unknown as Todo[]);
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthenticated) {
      router.push("/auth/login");
      return;
    }
    const text = newTodo.trim();
    if (!text || !userId) return;
    const supabase = createClient();
    setIsAdding(true);
    try {
      // 1) 如果有图片，先上传到 windofsummer/{userId}/{timestamp}-{filename}
      let imageUrl: string | null = null;
      if (newImageFile) {
        const path = `${userId}/${Date.now()}-${newImageFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("windofsummer")
          .upload(path, newImageFile, {
            cacheControl: "3600",
            upsert: false,
          });
        if (!uploadError) {
          const { data: urlData } = supabase.storage
            .from("windofsummer")
            .getPublicUrl(path);
          imageUrl = urlData.publicUrl;
        }
      }

      // 2) 插入 todo，并保存 image_url（如果存在）
      const { data, error } = await supabase
        .from("todos")
        .insert({ text, user_id: userId, image_url: imageUrl })
        .select("id, text, completed, image_url")
        .single();
      if (error) return;
      setTodos([data as unknown as Todo, ...todos]);
      setNewTodo("");
      setNewImageFile(null);
    } finally {
      setIsAdding(false);
    }
  };

  const toggleTodo = async (id: number) => {
    const supabase = createClient();
    const current = todos.find(t => t.id === id);
    if (!current) return;
    const nextCompleted = !current.completed;
    setTodos(todos.map(todo => todo.id === id ? { ...todo, completed: nextCompleted } : todo));
    const { error } = await supabase
      .from("todos")
      .update({ completed: nextCompleted })
      .eq("id", id)
      .select("id")
      .single();
    if (error) {
      // rollback
      setTodos(todos.map(todo => todo.id === id ? { ...todo, completed: !nextCompleted } : todo));
    }
  };

  const deleteTodo = async (id: number) => {
    const previous = todos;
    setDeletingId(id);
    setTodos(todos.filter(todo => todo.id !== id));
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from("todos")
        .delete()
        .eq("id", id);
      if (error) {
        setTodos(previous);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const startEditing = (todo: Todo) => {
    setEditingId(todo.id);
    setEditText(todo.text);
  };

  const saveEdit = async () => {
    if (!editText.trim() || !editingId) return;
    const text = editText.trim();
    const supabase = createClient();
    const previous = todos;
    setSavingId(editingId);
    setTodos(todos.map(todo => todo.id === editingId ? { ...todo, text } : todo));
    try {
      const { error } = await supabase
        .from("todos")
        .update({ text })
        .eq("id", editingId)
        .select("id")
        .single();
      if (error) {
        setTodos(previous);
        return;
      }
      setEditingId(null);
      setEditText("");
    } finally {
      setSavingId(null);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-white">Todo List</h1>
          </div>

          <form onSubmit={addTodo} className="mb-6">
            <div className="flex gap-2 flex-wrap sm:flex-nowrap items-stretch">
              <input
                type="text"
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                placeholder="Add a new task..."
                className="flex-1 shrink-0 px-4 py-2 rounded-lg bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-60"
                disabled={isAdding}
              />
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <input
                  id="todo-image"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setNewImageFile(e.target.files?.[0] ?? null)}
                  className="sr-only"
                  disabled={isAdding}
                />
                <label
                  htmlFor="todo-image"
                  className="shrink-0 cursor-pointer px-3 py-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors duration-200 text-white border border-white/30"
                >
                  选择图片
                </label>
                <span
                  className="text-white/80 text-sm truncate min-w-0 whitespace-nowrap flex-1"
                  title={newImageFile ? newImageFile.name : "未选择文件"}
                >
                  {newImageFile
                    ? (newImageFile.name.length > 10
                      ? newImageFile.name.slice(0, 10) + "…"
                      : newImageFile.name)
                    : "未选择文件"}
                </span>
              </div>
              <button
                type="submit"
                className="p-2 rounded-lg bg-white/20 hover:bg-white/30 transition-colors duration-200 text-white disabled:opacity-60 shrink-0 justify-center min-w-[88px]"
                disabled={isAdding}
              >
                {isAdding ? (
                  <span className="text-sm">Adding...</span>
                ) : (
                  <Plus className="w-6 h-6" />
                )}
              </button>
            </div>
          </form>

          <div className="space-y-3">
            {todos.map((todo) => (
              <div
                key={todo.id}
                className={cn(
                  "group flex items-center gap-3 p-3 rounded-lg transition-all duration-300",
                  "bg-white/10 hover:bg-white/20",
                  todo.completed && "opacity-75"
                )}
              >
                {todo.image_url && (
                  <img src={todo.image_url} alt="todo" className="w-12 h-12 rounded object-cover" />)
                }
                <button
                  onClick={() => toggleTodo(todo.id)}
                  className="text-white hover:scale-110 transition-transform duration-200"
                >
                  {todo.completed ? (
                    <Check className="w-6 h-6" />
                  ) : (
                    <Circle className="w-6 h-6" />
                  )}
                </button>
                
                {editingId === todo.id ? (
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="flex-1 px-3 py-1 rounded bg-white/20 border border-white/30 text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/50 disabled:opacity-60"
                      autoFocus
                      disabled={savingId === todo.id}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit();
                        if (e.key === 'Escape') cancelEdit();
                      }}
                    />
                    <button
                      onClick={saveEdit}
                      className="p-1 text-white hover:text-green-300 transition-colors disabled:opacity-60"
                      disabled={savingId === todo.id}
                    >
                      {savingId === todo.id ? <span className="text-xs">Saving...</span> : <Check className="w-5 h-5" />}
                    </button>
                    <button
                      onClick={cancelEdit}
                      className="p-1 text-white hover:text-red-300 transition-colors disabled:opacity-60"
                      disabled={savingId === todo.id}
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  <span
                    className={cn(
                      "flex-1 text-white transition-all duration-300",
                      todo.completed && "line-through opacity-75"
                    )}
                  >
                    {todo.text}
                  </span>
                )}
                
                {editingId !== todo.id && (
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => startEditing(todo)}
                      className="p-1 text-white hover:text-blue-300 transition-colors"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => deleteTodo(todo.id)}
                      className="p-1 text-white hover:text-red-300 transition-colors disabled:opacity-60"
                      disabled={deletingId === todo.id}
                    >
                      {deletingId === todo.id ? <span className="text-xs">Deleting...</span> : <Trash2 className="w-5 h-5" />}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {todos.length === 0 && (
            <div className="text-center text-white/70 mt-8">
              {isAuthenticated === false && "登录后制定Todo"}
              {isAuthenticated === true && "开始计划点什么吧"}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}