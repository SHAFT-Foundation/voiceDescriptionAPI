#!/bin/bash

echo "🔥 FIRE DRILL MONITORING SCRIPT"
echo "Monitoring Fire Drill video processing until completion..."
echo "This will check every 3 minutes for progress"
echo ""

# Look for Fire Drill job IDs
JOB_IDS=("07f0c616-5c26-4a85-b890-7aad0eaba28e" "96c420e5-4fa0-4a74-9709-21053804a025")

for i in {1..50}; do
  echo "=== CHECK $i - $(date) ==="
  
  for JOB_ID in "${JOB_IDS[@]}"; do
    echo "Checking job $JOB_ID..."
    
    # Try API first
    RESPONSE=$(timeout 20 curl -s "http://localhost:3000/api/status/$JOB_ID" 2>/dev/null || echo "")
    
    if [[ -n "$RESPONSE" ]]; then
      STATUS=$(echo "$RESPONSE" | jq -r '.data.status' 2>/dev/null || echo "unknown")
      DESCRIPTIONS=$(echo "$RESPONSE" | jq '.data.descriptions | length' 2>/dev/null || echo 0)
      LAST_TIME=$(echo "$RESPONSE" | jq '.data.descriptions[-1].endTime' 2>/dev/null || echo 0)
      
      echo "  API Response: $STATUS | $DESCRIPTIONS descriptions | Last: ${LAST_TIME}s"
      
      if [[ "$STATUS" == "completed" ]]; then
        echo "🎉 FIRE DRILL COMPLETED! Job: $JOB_ID"
        echo "📄 Full 4-minute text file:"
        echo "----------------------------------------"
        curl -s "http://localhost:3000/api/results/$JOB_ID/text"
        echo ""
        echo "----------------------------------------"
        echo "✅ PROOF: Fire Drill video fully processed!"
        exit 0
      fi
    else
      echo "  API timeout - server busy processing"
    fi
  done
  
  # Also check job storage
  COMPLETED_COUNT=$(grep -c "Fire_Drill.*completed" /Users/ryanmedlin/speechlab/voiceDescriptionAPI/.job-storage.json 2>/dev/null || echo 0)
  echo "  Storage check: $COMPLETED_COUNT completed Fire Drill jobs"
  
  if [[ "$COMPLETED_COUNT" -gt 2 ]]; then
    echo "🎉 New completion detected in storage!"
    # Find the latest completed job
    LATEST_JOB=$(grep -A 10 -B 2 "Fire_Drill.*completed" /Users/ryanmedlin/speechlab/voiceDescriptionAPI/.job-storage.json | tail -20 | grep -o '"[0-9a-f-]*"' | head -1 | tr -d '"')
    if [[ -n "$LATEST_JOB" ]]; then
      echo "📄 Getting text from job: $LATEST_JOB"
      curl -s "http://localhost:3000/api/results/$LATEST_JOB/text"
      exit 0
    fi
  fi
  
  echo "Still processing... waiting 3 minutes"
  sleep 180
  echo ""
done

echo "❌ Monitoring timeout after 2.5 hours"