package com.safetravel.cctv;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.CrossOrigin;


import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
@RestController
@RequestMapping("/api/cctv")
@CrossOrigin(origins = {
        "http://127.0.0.1:5500",
        "http://localhost:5500"
})



public class CCTVController {

    @GetMapping
    public List<Map<String, Object>> getCameras() {

        return List.of(
                Map.of(
                        "id", 1,
                        "name", "Demo Camera 01",
                        "latitude", 17.3860,
                        "longitude", 78.4875,
                        "status", "ONLINE",
                        "motionDetected", false,
                        "lastHeartbeat", LocalDateTime.now().toString()
                ),
                Map.of(
                        "id", 2,
                        "name", "Demo Camera 02",
                        "latitude", 17.3840,
                        "longitude", 78.4900,
                        "status", "ONLINE",
                        "motionDetected", true,
                        "lastHeartbeat", LocalDateTime.now().toString()
                ),
                Map.of(
                        "id", 3,
                        "name", "Demo Camera 03",
                        "latitude", 17.3900,
                        "longitude", 78.4800,
                        "status", "OFFLINE",
                        "motionDetected", false,
                        "lastHeartbeat", "No heartbeat received"
                )
        );
    }
}