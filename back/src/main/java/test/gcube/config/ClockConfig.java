package test.gcube.config;

import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * 업무 기준시각.
 *
 * <p>데이터의 기준시각은 2026년 7월 21일 오전 9시다. 실제 시계를 쓰면 배송예정일이
 * 전부 과거가 되어 "배송일 전날까지 쓸 수 있는 입고예정" 같은 규칙이 의미를 잃는다.
 * 그래서 기준시각을 고정 Clock 으로 주입하고, 업무 판단에 쓰는 '오늘'은 모두 여기서 가져온다.
 *
 * <p>{@code app.base-time} 을 비우면 실제 시계를 쓴다.
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock(@Value("${app.base-time:}") String baseTime,
                       @Value("${spring.jackson.time-zone:Asia/Seoul}") String zoneId) {
        ZoneId zone = ZoneId.of(zoneId);
        if (baseTime == null || baseTime.isBlank()) {
            return Clock.system(zone);
        }
        return Clock.fixed(LocalDateTime.parse(baseTime).atZone(zone).toInstant(), zone);
    }
}
