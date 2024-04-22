import React, { useState, useEffect } from 'react';

interface ProgressStepsProps {
//   parseQueryTime?: number;
  modelAnalysisTime?: number;
  externalSearchTime?: number;
  chatTime?: number;
}

const ProgressSteps: React.FC<ProgressStepsProps> = ({
    modelAnalysisTime, externalSearchTime, chatTime
  }) => {    
    const [currentStage, setCurrentStage] = useState(1); // 初始化时第一个阶段已激活
    const [progress, setProgress] = useState(0);

  const stages = [
    { id: 1, name: "获得问题", icon: "🔍", time: 0 }, // 0 或任何非null值，以保持激活状态
    { id: 2, name: "大模型解析", icon: "🧠", time: modelAnalysisTime },
    { id: 3, name: "外部搜索", icon: "🌐", time: externalSearchTime },
    { id: 4, name: "智能排序", icon: "📊", time: chatTime }
  ];

  useEffect(() => {
    const activeStages = stages.filter(stage => stage.time !== null && stage.time !== undefined).length;
    setCurrentStage(Math.max(activeStages, 1)); // 确保最少激活一个阶段
    setProgress((activeStages / stages.length) * 100);
  }, [modelAnalysisTime, externalSearchTime, chatTime]);

  return (
    <div className="w-full bg-gray-200 h-2 rounded overflow-hidden">
      <div className="bg-green-500 h-full" style={{ width: `${progress}%` }}></div>
      <div className="flex justify-between px-2 mt-2">
        {stages.map((stage, index) => (
          <div key={stage.id} className={`flex flex-col items-center ${index < currentStage ? 'text-green-500' : 'text-gray-500'}`}>
            <span className="text-lg">{stage.icon}</span>
            <span className="text-xs">{stage.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProgressSteps;
