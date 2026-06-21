import { View, Text, Button, Input } from "@tarojs/components";
import { useState, useCallback } from "react";
import "./index.scss";

interface Group { id: number; name: string; time: string; people: number; max: number; }

export default function LunchPage() {
  const [groups, setGroups] = useState<Group[]>([
    { id: 1, name: "附近聚餐", time: "12:00", people: 3, max: 6 },
    { id: 2, name: "轻食小分队", time: "12:30", people: 2, max: 4 },
  ]);
  const [newName, setNewName] = useState("");

  const joinGroup = useCallback((id: number) => {
    setGroups(prev => prev.map(g =>
      g.id === id && g.people < g.max ? { ...g, people: g.people + 1 } : g
    ));
  }, []);

  const createGroup = useCallback(() => {
    if (!newName.trim()) return;
    setGroups(prev => [...prev, { id: Date.now(), name: newName, time: "12:00", people: 1, max: 4 }]);
    setNewName("");
  }, [newName]);

  return (
    <View className="lunch-page">
      <View className="header">
        <Text className="title">午餐搭子</Text>
      </View>
      <View className="create-section">
        <Input className="input" value={newName} onInput={e => setNewName(e.detail.value)} placeholder="新建饭局名称" />
        <Button className="btn" onClick={createGroup}>创建</Button>
      </View>
      {groups.map(g => (
        <View key={g.id} className="group-card">
          <Text className="group-name">{g.name}</Text>
          <Text className="group-time">{g.time}</Text>
          <Text className="group-count">{g.people}/{g.max}人</Text>
          <Button className="join-btn" disabled={g.people >= g.max} onClick={() => joinGroup(g.id)}>
            {g.people >= g.max ? "已满" : "加入"}
          </Button>
        </View>
      ))}
    </View>
  );
}
