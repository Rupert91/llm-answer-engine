import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { HiOutlineSave } from "react-icons/hi";
export interface SearchResult {
  favicon?: string;
  link: string;
  title: string;
  snippet: any;
  position: number;
}

const ResultItemComponent = ({
  item
}: {
  item:SearchResult
}) => {
  const handleSaveClick = async (
    e: React.MouseEvent<HTMLSpanElement, MouseEvent>,
    item: SearchResult
  ) => {
    e.stopPropagation(); // 阻止事件冒泡，避免同时触发保存操作和其他可能的点击事件

    // 正确地将被点击的项目作为数组的单个元素传递
    try {
      const response = await fetch("/api/addData", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(item),
      });

      if (response.ok) {
        // 如果请求成功，可以根据需要做出相应的处理，比如重置表单或者显示成功消息
        console.log("Data added successfully!");
      } else {
        // 处理请求失败的情况，比如显示错误消息
        console.error("Failed to add data");
      }
    } catch (error) {
      console.error("Error saving the item:", error);
      // toast.error('Error saving the item.');
    }
  };

  return (
    <div
      onClick={() => window.open(item.link, "_blank")}
      className="w-full mb-2 cursor-pointer p-2 bg-blue-100 border-blue-200 rounded-lg"
    >
      <div className="w-full flex justify-between line-clamp-1 bg-blue-100 rounded-lg">
        <h1 className="font-bold flex-1">{item.title}</h1>
        <span
          className="text-xs text-gray-600 cursor-pointer"
          onClick={(e) => handleSaveClick(e, item)}
        >
          <Tooltip>
            <TooltipTrigger>
              <HiOutlineSave className="text-lg" />
            </TooltipTrigger>
            <TooltipContent>Save to your filter</TooltipContent>
          </Tooltip>
        </span>
      </div>
      <p
        className="text-sm text-gray-700 line-clamp-2"
        dangerouslySetInnerHTML={{ __html: item?.snippet }}
      ></p>
    </div>
  );
}
export default ResultItemComponent