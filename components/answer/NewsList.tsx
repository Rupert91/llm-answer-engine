import React, { useState, useEffect } from 'react';

// 定义单个数据项的接口
interface DataItem {
    title: string;
    position: number;
    snippet: string;
    link: string;
    reason: string;
  }
  
  // 定义组件props的接口
  interface DataStreamRendererProps {
    llmResponseString: string;
    llmResponseEnd: boolean;
  }
  

// DataStreamRenderer 组件
const DataStreamRenderer: React.FC<DataStreamRendererProps> = ({ llmResponseString, llmResponseEnd }) => {
    const [data, setData] = useState<DataItem[]>([]);
    const [isComplete, setIsComplete] = useState(false);
  
    // 当接收到llmResponseEnd信号时，尝试解析数据
    useEffect(() => {
      if (llmResponseEnd) {
        try {
          const parsedData = JSON.parse(llmResponseString) as DataItem[];
          setData(parsedData);
          setIsComplete(true);
        } catch (error) {
          console.error("Failed to parse JSON:", error);
        }
      }
    }, [llmResponseString, llmResponseEnd]);
  
    // 渲染数据
    return (
      <div>
        <h1>Data Stream Results</h1>
        {isComplete ? (
          <ul>
            {data.map((item, index) => (
              <li key={index}>
                <h2>{item.title} (Position: {item.position})</h2>
                <p>{item.snippet}</p>
                <a href={item.link} target="_blank" rel="noopener noreferrer">Read More</a>
                <p><strong>Reason:</strong> {item.reason}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p>Loading data...</p>
        )}
      </div>
    );
  }
  
  export default DataStreamRenderer;
