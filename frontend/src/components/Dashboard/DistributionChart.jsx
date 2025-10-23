import React from 'react';

const DistributionChart = ({ shares }) => {
  const total = shares.verifier + shares.brand + shares.treasury;
  
  const chartData = [
    {
      name: 'Verifiers',
      value: shares.verifier,
      percentage: total > 0 ? ((shares.verifier / total) * 100).toFixed(1) : 0,
      color: '#4F46E5'
    },
    {
      name: 'Brands',
      value: shares.brand,
      percentage: total > 0 ? ((shares.brand / total) * 100).toFixed(1) : 0,
      color: '#10B981'
    },
    {
      name: 'Treasury',
      value: shares.treasury,
      percentage: total > 0 ? ((shares.treasury / total) * 100).toFixed(1) : 0,
      color: '#F59E0B'
    }
  ];

  return (
    <div className="distribution-chart">
      <h3>Distribution Breakdown</h3>
      
      <div className="chart-container">
        <div className="pie-chart">
          <svg width="200" height="200" viewBox="0 0 200 200">
            {chartData.map((item, index) => {
              const previousPercentages = chartData
                .slice(0, index)
                .reduce((sum, prevItem) => sum + parseFloat(prevItem.percentage), 0);
              
              const startAngle = (previousPercentages / 100) * 360;
              const endAngle = startAngle + (parseFloat(item.percentage) / 100) * 360;
              
              const startAngleRad = (startAngle * Math.PI) / 180;
              const endAngleRad = (endAngle * Math.PI) / 180;
              
              const x1 = 100 + 80 * Math.cos(startAngleRad);
              const y1 = 100 + 80 * Math.sin(startAngleRad);
              const x2 = 100 + 80 * Math.cos(endAngleRad);
              const y2 = 100 + 80 * Math.sin(endAngleRad);
              
              const largeArcFlag = parseFloat(item.percentage) > 50 ? 1 : 0;
              
              const pathData = [
                `M 100 100`,
                `L ${x1} ${y1}`,
                `A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                `Z`
              ].join(' ');
              
              return (
                <path
                  key={item.name}
                  d={pathData}
                  fill={item.color}
                  stroke="white"
                  strokeWidth="2"
                />
              );
            })}
          </svg>
        </div>
        
        <div className="chart-legend">
          {chartData.map((item) => (
            <div key={item.name} className="legend-item">
              <div
                className="legend-color"
                style={{ backgroundColor: item.color }}
              ></div>
              <span className="legend-label">{item.name}</span>
              <span className="legend-value">{item.percentage}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default DistributionChart;
