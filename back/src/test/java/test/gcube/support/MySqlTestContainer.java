package test.gcube.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.containers.MySQLContainer;
import org.testcontainers.utility.DockerImageName;

/**
 * 테스트 전용 MySQL.
 *
 * <p>테스트가 개발용 DB 를 공유하면, 화면에서 발주 하나만 만들어도 단언이 깨지고
 * 반대로 테스트를 돌리면 화면에서 만든 데이터가 사라진다. 어느 쪽도 좋지 않아서
 * 테스트는 자기 컨테이너를 띄우고 끝나면 버린다. 덕분에 저장소를 처음 받은 사람도
 * 앱을 띄우지 않고 {@code ./gradlew test} 만으로 전부 돌릴 수 있다.
 *
 * <p>컨테이너는 JVM 당 한 번만 띄운다({@code static} 필드 + 수동 {@code start}).
 * 클래스마다 새로 띄우면 테스트 시간을 컨테이너 기동이 다 먹는다. 스키마는 기동
 * 스크립트로 한 번 만들고, 기준 데이터는 각 테스트의 {@code @Sql} 이 다시 적재한다.
 */
@TestConfiguration(proxyBeanMethods = false)
public class MySqlTestContainer {

    private static final MySQLContainer<?> CONTAINER =
            new MySQLContainer<>(DockerImageName.parse("mysql:8.4"))
                    .withDatabaseName("gcube")
                    .withUsername("gcube")
                    .withPassword("gcube")
                    .withUrlParam("characterEncoding", "UTF-8")
                    .withUrlParam("serverTimezone", "Asia/Seoul")
                    .withCommand(
                            "--character-set-server=utf8mb4",
                            "--collation-server=utf8mb4_0900_ai_ci",
                            "--default-time-zone=+09:00",
                            "--transaction-isolation=REPEATABLE-READ")
                    // DDL 만 적재한다. 기준 데이터는 각 테스트의 @Sql 이 넣는다.
                    .withInitScript("schema/schema.sql");

    static {
        CONTAINER.start();
    }

    @Bean
    @ServiceConnection
    MySQLContainer<?> mysqlContainer() {
        return CONTAINER;
    }
}
