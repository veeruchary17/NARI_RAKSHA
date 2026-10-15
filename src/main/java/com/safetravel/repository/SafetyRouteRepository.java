package com.safetravel.repository;

import com.safetravel.entity.SafetyRoute;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SafetyRouteRepository
        extends JpaRepository<SafetyRoute, Long> {

}
